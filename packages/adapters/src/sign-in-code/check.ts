import type { IndianMobile } from '@rivr/contracts';
import type { VerifyNowAdapter, VerifyNowRefusal } from '../verify-now/index.ts';

/** What the database says to do with a typed code (`sign_in_code_attempt`), the try counted. */
export type SignInCodeAttempt =
  /** Ask VerifyNow about the code under this check. */
  | { readonly verificationId: string }
  /** VerifyNow accepted this very code in the last two minutes: Auth's code again. */
  | { readonly token: string }
  /** The caller's address has checked too often. */
  | { readonly refusal: 'too_many' }
  /** No check waits for the number: VerifyNow sent it no code, or its tries or time ran out. */
  | null;

/** Auth's codes kept for VerifyNow sign-ins (`private.sign_in_code_relay`). */
export interface SignInCodeStore {
  attempt(input: { readonly phone: IndianMobile; readonly code: string; readonly client: string }): Promise<SignInCodeAttempt>;
  /** Auth's code once VerifyNow accepted `code` under `verificationId`; null when that is no longer the number's check. */
  take(input: { readonly phone: IndianMobile; readonly verificationId: string; readonly code: string }): Promise<string | null>;
}

/** Why a typed code is refused, as the app's sign-in screen tells it. */
export type SignInCheckRefusal = 'code_rejected' | 'too_many_requests' | 'unavailable';

/** What sign-in-verify answers the app: Auth's code to sign in with (or null), or a refusal. */
export type SignInCheckReply =
  | { readonly status: 200; readonly body: { readonly token: string | null } }
  | { readonly status: 400 | 429 | 502; readonly body: { readonly error: SignInCheckRefusal } };

/** The typed code goes to Auth as it is. */
const CHECK_WITH_AUTH: SignInCheckReply = { status: 200, body: { token: null } };

function refusal(why: VerifyNowRefusal): SignInCheckReply {
  switch (why) {
    // The screen tells a wrong code and an expired one alike, as it does Auth's.
    case 'wrong_code':
    case 'expired':
      return { status: 400, body: { error: 'code_rejected' } };
    case 'too_many':
      return { status: 429, body: { error: 'too_many_requests' } };
    default:
      return { status: 502, body: { error: 'unavailable' } };
  }
}

/**
 * Checks a sign-in code the member typed (decision 0679). While VerifyNow sends the codes, a code it
 * accepts gives back Auth's code for the number, which the app signs in with. With no VerifyNow check
 * waiting (VerifyNow off, or a test number, which Auth answers without the hook) the reply says to
 * check the typed code with Auth itself. The store counts the tries: five per code, 30 per address in
 * five minutes. `client` is the caller's address.
 */
export async function checkSignInCode(
  { phone, code, client }: { readonly phone: IndianMobile; readonly code: string; readonly client: string },
  verifyNow: VerifyNowAdapter | null,
  store: SignInCodeStore,
): Promise<SignInCheckReply> {
  if (verifyNow === null) return CHECK_WITH_AUTH;
  const attempt = await store.attempt({ phone, code, client });
  if (attempt === null) return CHECK_WITH_AUTH;
  if ('refusal' in attempt) return refusal('too_many');
  if ('token' in attempt) return { status: 200, body: { token: attempt.token } };
  const checked = await verifyNow.check({ verificationId: attempt.verificationId, code });
  if (!checked.ok) return refusal(checked.error);
  const token = await store.take({ phone, verificationId: attempt.verificationId, code });
  return token === null ? refusal('expired') : { status: 200, body: { token } };
}
