import { err, ok, type IndianMobile, type Result } from '@rivr/contracts';
import type { AdapterFailure } from '../shared/failure.ts';
import type { SmsOtpAdapter } from '../sms-otp/index.ts';
import type { WhatsAppAdapter } from '../whatsapp/index.ts';

/**
 * The name of the WhatsApp authentication template that carries a sign-in code as its one
 * parameter. Exported because it must match the template approved in Meta's dashboard.
 */
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

/** Sends by one channel, or null when that channel is not configured. */
function sendBy(channels: SignInCodeChannels, channel: SignInCodeSent['channel'], to: IndianMobile, code: string) {
  if (channel === 'whatsapp') {
    return channels.whatsapp?.sendTemplate({ category: 'authentication', to, template: SIGN_IN_CODE_TEMPLATE, params: [code] }) ?? null;
  }
  return channels.smsOtp?.sendOtp({ to, code }) ?? null;
}

/**
 * Sends a sign-in code: the WhatsApp authentication template first, SMS when WhatsApp fails or is
 * not configured (scope-v1, module 1). `preferSms` turns the order round, for a second code within
 * ten minutes (#181). With no channel configured it fails closed with `not_configured`: a fake must
 * never report a code as sent to a real person.
 */
export async function sendSignInCode(
  channels: SignInCodeChannels,
  { to, code, preferSms = false }: { readonly to: IndianMobile; readonly code: string; readonly preferSms?: boolean },
): Promise<Result<SignInCodeSent, AdapterFailure>> {
  const order: SignInCodeSent['channel'][] = preferSms ? ['sms', 'whatsapp'] : ['whatsapp', 'sms'];
  // Stays not_configured if no channel is tried; otherwise the last channel's failure is reported.
  let lastFailure: AdapterFailure = { code: 'not_configured' };
  for (const channel of order) {
    const sent = await sendBy(channels, channel, to, code);
    if (sent === null) continue;
    if (sent.ok) return ok({ channel, messageId: sent.value.messageId });
    lastFailure = sent.error;
  }
  return err(lastFailure);
}
