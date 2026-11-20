import { FunctionsFetchError } from '@supabase/supabase-js';
import { functionErrorCode } from './kycFailure.ts';

/**
 * Why a sign-in step failed, in the five ways the screen explains. Supabase Auth answers a
 * wrong code and an expired code alike (`otp_expired`), so the screen cannot tell them apart.
 * `no_connection` is a request that got no answer the app could read, the phone's connection most
 * often; `unavailable` is an answer that says the service failed. A function the gateway cannot run
 * (boot error, timeout) may answer without CORS headers, which the browser reports as no answer too:
 * many members' `refused:no_connection` at once is an outage, not their phones.
 */
export type SignInFailure = 'code_rejected' | 'too_many_requests' | 'not_checked' | 'no_connection' | 'unavailable';

/** The parts of a Supabase AuthError the screen needs. */
export interface AuthErrorLike {
  readonly status?: number | undefined;
  readonly code?: string | undefined;
}

/** Reads an Auth error. Anything unrecognised is `unavailable`: the code did not go out or did not check. */
export function toSignInFailure({ status, code }: AuthErrorLike): SignInFailure {
  if (code === 'otp_expired') return 'code_rejected';
  // The CAPTCHA was missing, expired or failed (#182).
  if (code === 'captcha_failed') return 'not_checked';
  if (status === 429) return 'too_many_requests';
  // Auth's client gives status 0 when no answer came back, or one it could not read.
  if (status === 0) return 'no_connection';
  return 'unavailable';
}

/**
 * Reads sign-in-verify's refusal (decision 0679): a wrong or expired VerifyNow code, or too many
 * tries; a request that got no answer is `no_connection`. Anything else is `unavailable`.
 */
export async function toSignInCheckFailure(error: unknown): Promise<SignInFailure> {
  if (error instanceof FunctionsFetchError) return 'no_connection';
  const code = await functionErrorCode(error);
  return code === 'code_rejected' || code === 'too_many_requests' ? code : 'unavailable';
}
