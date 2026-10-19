import { sendSmsHookSchema, type IndianMobile } from '@rivr/contracts';
import type { AdapterFailure } from '../shared/failure.ts';
import { SEND_BUDGET_MS, sendSignInCode, type SignInCodeChannels } from './send.ts';

/** What the Edge Function answers Auth: HTTP 200, with an empty body or an error for the app. */
export interface HookReply {
  readonly status: 200;
  readonly body: Record<string, never> | { readonly error: { readonly http_code: number; readonly message: string } };
}

/**
 * A refusal Auth passes on to the app. Auth reads an error only from an HTTP 200 reply; for any
 * other status it drops the body and answers the app with a bare 500, so the app could not tell
 * "wait a minute" from "cannot send". `httpCode` and `message` are what the app receives.
 */
export function hookError(httpCode: number, message: string): HookReply {
  return { status: 200, body: { error: { http_code: httpCode, message } } };
}

function replyTo(failure: AdapterFailure): HookReply {
  switch (failure.code) {
    case 'not_configured':
      return hookError(503, 'Sign-in codes cannot be sent yet.');
    case 'rate_limited':
      return hookError(429, 'Too many codes were sent. Wait a minute and try again.');
    default:
      return hookError(502, 'The code could not be sent. Try again.');
  }
}

/**
 * Notes that a code is going to `to`, and says whether one already went there in the last ten
 * minutes. Kept as a keyed hash of the number and the time only, never the code (#181).
 */
export type NoteSignInCodeSend = (to: IndianMobile) => Promise<boolean>;

/**
 * Answers Supabase Auth's Send SMS hook once its signature is checked: sends the code through the
 * live channels and replies the way Auth expects. Named after Supabase's hook, though the code goes
 * by WhatsApp first. A second code to a number within ten minutes goes by SMS first: Meta accepts a
 * code for a number not on WhatsApp and reports the failure only later (error 131026), so the member
 * asking again is the sign the first never arrived. The code is never logged or stored (decision 0025).
 */
export async function handleSendSmsHook(payload: unknown, channels: SignInCodeChannels, noteSend?: NoteSignInCodeSend): Promise<HookReply> {
  // Counted from the call, so noting the send comes out of the same 5 seconds Auth waits.
  const deadline = Date.now() + SEND_BUDGET_MS;
  const hook = sendSmsHookSchema.safeParse(payload);
  if (!hook.success) return hookError(400, 'The hook payload is not a sign-in code for an Indian mobile.');
  const preferSms = noteSend ? await noteSend(hook.data.to) : false;
  const sent = await sendSignInCode(channels, { ...hook.data, preferSms, deadline });
  return sent.ok ? { status: 200, body: {} } : replyTo(sent.error);
}
