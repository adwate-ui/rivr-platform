import type { IndianMobile, Result } from '@rivr/contracts';
import type { AdapterFailure } from '../shared/failure.ts';

/** Sends sign-in codes by SMS, the fallback when the WhatsApp authentication template cannot deliver. */
export interface SmsOtpAdapter {
  /** Sends `code` to `to`; the vendor's message id comes back for delivery tracking. */
  sendOtp(input: { readonly to: IndianMobile; readonly code: string }): Promise<Result<{ readonly messageId: string }, AdapterFailure>>;
}
