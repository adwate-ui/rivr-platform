import { err, ok, type IndianMobile, type Result } from '@rivr/contracts';
import type { AdapterFailure } from '../shared/failure.ts';
import type { SmsOtpAdapter } from '../sms-otp/index.ts';
import type { WhatsAppAdapter, WhatsAppLanguage } from '../whatsapp/index.ts';

/** The approved WhatsApp authentication template that carries a sign-in code as its one parameter. */
export const SIGN_IN_CODE_TEMPLATE = 'sign_in_code';

/** The channels that have live credentials. A channel left out is not tried. */
export interface SignInCodeChannels {
  readonly whatsapp?: WhatsAppAdapter | undefined;
  readonly smsOtp?: SmsOtpAdapter | undefined;
}

/** Which channel delivered the code. */
export interface SignInCodeSent {
  readonly channel: 'whatsapp' | 'sms';
  readonly messageId: string;
}

/**
 * Sends a sign-in code: the WhatsApp authentication template first, SMS when WhatsApp fails or is
 * not configured (scope-v1, module 1). With no channel configured it fails closed with
 * `not_configured`: a fake must never report a code as sent to a real person.
 */
export async function sendSignInCode(
  channels: SignInCodeChannels,
  { to, code, language = 'en' }: { readonly to: IndianMobile; readonly code: string; readonly language?: WhatsAppLanguage },
): Promise<Result<SignInCodeSent, AdapterFailure>> {
  let lastFailure: AdapterFailure = { code: 'not_configured' };
  if (channels.whatsapp) {
    const sent = await channels.whatsapp.sendTemplate({ category: 'authentication', to, template: SIGN_IN_CODE_TEMPLATE, language, params: [code] });
    if (sent.ok) return ok({ channel: 'whatsapp', messageId: sent.value.messageId });
    lastFailure = sent.error;
  }
  if (channels.smsOtp) {
    const sent = await channels.smsOtp.sendOtp({ to, code });
    if (sent.ok) return ok({ channel: 'sms', messageId: sent.value.messageId });
    lastFailure = sent.error;
  }
  return err(lastFailure);
}
