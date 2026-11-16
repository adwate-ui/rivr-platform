import type { IndianMobile, Result } from '@rivr/contracts';
import type { AdapterFailure } from '../shared/failure.ts';

/** Why VerifyNow did not accept a typed code: wrong, no longer valid, tried too often, or no answer. */
export type VerifyNowRefusal = 'wrong_code' | 'expired' | 'too_many' | 'unavailable';

/**
 * Sign-in codes by SMS through Message Central's VerifyNow (decision 0679). VerifyNow makes the code,
 * texts it on its own registered template and checks it: RIVR never sees the code.
 */
export interface VerifyNowAdapter {
  /**
   * Texts `to` a six-digit code; the id to check it by. The id is null when VerifyNow's last code to
   * the number still stands (it texts a number once a minute at most): that code is the one to type.
   */
  send(input: { readonly to: IndianMobile }): Promise<Result<{ readonly verificationId: string | null }, AdapterFailure>>;
  /** Checks the code the member typed against the one texted under `verificationId`. */
  check(input: { readonly verificationId: string; readonly code: string }): Promise<Result<null, VerifyNowRefusal>>;
}
