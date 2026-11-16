import { PHONE_CHANGE, sendSmsHookSchema, type IndianMobile, type SignInCodeToSend } from '@rivr/contracts';
import type { AdapterFailure } from '../shared/failure.ts';
import type { VerifyNowAdapter } from '../verify-now/index.ts';
import { SEND_BUDGET_MS, sendSignInCode, type SignInCodeChannels } from './send.ts';

/** What the Edge Function answers Auth: HTTP 200, with an empty body or an error for the app. */
export interface HookReply {
  readonly status: 200;
  readonly body: Record<string, never> | { readonly error: { readonly http_code: number; readonly message: string } };
}

/**
 * A refusal Auth passes on to the app. The reply itself is always HTTP 200: Auth reads an error only
 * from a 200, and for any other status it drops the body and answers the app with a bare 500, so the
 * app could not tell "wait a minute" from "cannot send". `httpCode` and `message` are what the app
 * receives, and the message is also what Auth's log keeps: the only record of why a code was not sent.
 */
export function hookError(httpCode: number, message: string): HookReply {
  return { status: 200, body: { error: { http_code: httpCode, message } } };
}

/**
 * The `http_code` for a code that was not sent: never a 5xx (decision 0683). Supabase's gateway sends a
 * request again when Auth answers it with a 5xx, and the second try carries the CAPTCHA token the first
 * one spent, so Auth then refuses it as `captcha_failed` and the app says the security check failed.
 * The app reads 424 as sign-in being down.
 */
export const CODE_NOT_SENT = 424;

/** Which step failed, for Auth's log: the vendor's send, or keeping Auth's code with VerifyNow's check. */
type Step = 'send' | 'keep';

/**
 * The refusal for a failure at `step`. A code not sent says which step and why, such as
 * "The code could not be sent. Try again. (send: VerifyNow did not answer)".
 */
function replyTo(failure: AdapterFailure, step: Step): HookReply {
  switch (failure.code) {
    case 'not_configured':
      return hookError(CODE_NOT_SENT, `Sign-in codes cannot be sent yet. (${step}: not configured)`);
    case 'rate_limited':
      return hookError(429, 'Too many codes were sent. Wait a minute and try again.');
    default: {
      // A reason never holds the number or the code (AdapterFailure). The message reaches the caller as well as Auth's
      // log, so a long run of digits is masked all the same.
      const why = (failure.reason ?? failure.code).replace(/\d{7,}/g, '[digits]');
      return hookError(CODE_NOT_SENT, `The code could not be sent. Try again. (${step}: ${why})`);
    }
  }
}

/**
 * Auth's code length is wrong for the way codes are sent (runbook step 7a): WhatsApp and SMS send Auth's
 * own six digits, while with VerifyNow Auth's code is ten digits and VerifyNow texts six of its own.
 */
const WRONG_CODE_LENGTH = hookError(CODE_NOT_SENT, 'Sign-in codes cannot be sent yet. (Auth code length)');

/**
 * Notes that a code is going to `to`, and says whether one already went there in the last ten
 * minutes. Kept as a keyed hash of the number and the time only, never the code (#181).
 */
export type NoteSignInCodeSend = (to: IndianMobile) => Promise<boolean>;

/** The number and code from Auth's payload, or the refusal to answer it with. */
function parseHook(payload: unknown): SignInCodeToSend | HookReply {
  const hook = sendSmsHookSchema.safeParse(payload);
  // A member's own phone change through PUT /user: no code goes out (#502); the club changes numbers.
  if (!hook.success && hook.error.issues.some((issue) => issue.message === PHONE_CHANGE)) {
    return hookError(403, 'Your phone number is changed at the club. Please ask at the front desk.');
  }
  return hook.success ? hook.data : hookError(400, 'The hook payload is not a sign-in code for an Indian mobile.');
}

/**
 * Answers Supabase Auth's Send SMS hook once its signature is checked: sends the code through the
 * live channels and replies the way Auth expects. Named after Supabase's hook, though the code goes
 * by WhatsApp first. A second code to a number within ten minutes goes by SMS first: Meta accepts a
 * code for a number not on WhatsApp and reports the failure only later (error 131026), so the member
 * asking again is the sign the first never arrived. The code is never logged or stored (decision 0025).
 */
export async function handleSendSmsHook(
  payload: unknown,
  channels: SignInCodeChannels,
  noteSend?: NoteSignInCodeSend,
  keepAlive?: (send: Promise<unknown>) => void,
): Promise<HookReply> {
  // Counted from the call, so noting the send comes out of the same 5 seconds Auth waits.
  const deadline = Date.now() + SEND_BUDGET_MS;
  const hook = parseHook(payload);
  if ('status' in hook) return hook;
  // A member types six digits. A longer code means Auth's length was left at VerifyNow's ten (runbook step 7a).
  if (hook.code.length !== 6) return WRONG_CODE_LENGTH;
  const preferSms = noteSend ? await noteSend(hook.to) : false;
  const sent = await sendSignInCode(channels, { ...hook, preferSms, deadline, keepAlive });
  return sent.ok ? { status: 200, body: {} } : replyTo(sent.error, 'send');
}

/**
 * Keeps Auth's code for `to` with the VerifyNow check that stands in for it (`keep_sign_in_code`),
 * by `deadline` (epoch ms). With no `verificationId`, VerifyNow's last code to the number still
 * stands, and Auth's new code goes with that check. False when the code could not be kept.
 */
export type KeepSignInCode = (to: IndianMobile, code: string, verificationId: string | null, deadline: number) => Promise<boolean>;

/** The length of Auth's code while VerifyNow sends the codes (`sms_otp_length`, decision 0679). */
export const AUTH_CODE_LENGTH = 10;

/**
 * The same hook while Message Central's VerifyNow sends sign-in codes (decision 0679). VerifyNow texts
 * a code of its own, so Auth's goes nowhere: it is kept, encrypted, until VerifyNow accepts the code
 * the member types (`checkSignInCode`), and the app signs in with it then. Keeping it gets whatever
 * is left of Auth's 5 seconds after VerifyNow's send.
 */
export async function relaySmsHook(payload: unknown, verifyNow: VerifyNowAdapter, keep: KeepSignInCode): Promise<HookReply> {
  const deadline = Date.now() + SEND_BUDGET_MS;
  const hook = parseHook(payload);
  if ('status' in hook) return hook;
  // Auth's code must be ten digits while it waits ten minutes unseen (runbook step 7a): a shorter one
  // could be guessed at Auth's verify endpoint. A setting missed shows as sign-in down, not a hole.
  if (hook.code.length < AUTH_CODE_LENGTH) return WRONG_CODE_LENGTH;
  const sent = await verifyNow.send({ to: hook.to });
  if (!sent.ok) return replyTo(sent.error, 'send');
  const isKept = await keep(hook.to, hook.code, sent.value.verificationId, deadline);
  if (isKept) return { status: 200, body: {} };
  // VerifyNow will not text the number again yet, and its last code can no longer be used (accepted,
  // out of tries, or never kept): the member waits for VerifyNow's minute to pass.
  return replyTo({ code: sent.value.verificationId === null ? 'rate_limited' : 'unavailable' }, 'keep');
}
