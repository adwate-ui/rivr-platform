/**
 * Why a sign-in step failed, in the four ways the screen explains. Supabase Auth answers a
 * wrong code and an expired code alike (`otp_expired`), so the screen cannot tell them apart.
 */
export type SignInFailure = 'code_rejected' | 'too_many_requests' | 'not_checked' | 'unavailable';

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
  return 'unavailable';
}
