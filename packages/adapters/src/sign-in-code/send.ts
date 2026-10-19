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

/**
 * Auth waits 5 seconds for its Send SMS hook. Every send of one code must end within this many
 * milliseconds of the hook's call, so the reply reaches Auth in time (decision 0025).
 */
export const SEND_BUDGET_MS = 4_500;

/** Kept back from the first channel for the second, so a fallback always has time to go out. */
export const FALLBACK_RESERVE_MS = 1_000;

/** A send that has not finished within `ms` counts as unavailable; its request is left to end on its own. */
async function within<T>(send: Promise<Result<T, AdapterFailure>>, ms: number): Promise<Result<T, AdapterFailure>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<Result<T, AdapterFailure>>((resolve) => {
    timer = setTimeout(() => resolve(err({ code: 'unavailable' })), ms);
  });
  try {
    return await Promise.race([send, late]);
  } finally {
    clearTimeout(timer);
  }
}

/** Sends by one channel, or null when that channel is not configured. */
function sendBy(channels: SignInCodeChannels, channel: SignInCodeSent['channel'], to: IndianMobile, code: string) {
  if (channel === 'whatsapp') {
    return channels.whatsapp?.sendTemplate({ category: 'authentication', to, template: SIGN_IN_CODE_TEMPLATE, params: [code] }) ?? null;
  }
  return channels.smsOtp?.sendOtp({ to, code }) ?? null;
}

export interface SignInCodeToSend {
  readonly to: IndianMobile;
  readonly code: string;
  /** SMS first, for a second code within ten minutes (#181). */
  readonly preferSms?: boolean;
  /** When every send must have ended (epoch ms); `SEND_BUDGET_MS` from now by default. */
  readonly deadline?: number;
}

/**
 * Sends a sign-in code: the WhatsApp authentication template first, SMS when WhatsApp fails or is
 * not configured (scope-v1, module 1); `preferSms` turns the order round. Both fit before
 * `deadline`: the first channel leaves `FALLBACK_RESERVE_MS` for the second. With no channel
 * configured it fails closed with `not_configured`: a fake must never report a code as sent to a
 * real person.
 */
export async function sendSignInCode(
  channels: SignInCodeChannels,
  { to, code, preferSms = false, deadline = Date.now() + SEND_BUDGET_MS }: SignInCodeToSend,
): Promise<Result<SignInCodeSent, AdapterFailure>> {
  const order: SignInCodeSent['channel'][] = preferSms ? ['sms', 'whatsapp'] : ['whatsapp', 'sms'];
  const configured = order.filter((channel) => (channel === 'whatsapp' ? channels.whatsapp : channels.smsOtp) !== undefined);
  // Stays not_configured if no channel is tried; otherwise the last channel's failure is reported.
  let lastFailure: AdapterFailure = { code: 'not_configured' };
  for (const [index, channel] of configured.entries()) {
    const reserve = index < configured.length - 1 ? FALLBACK_RESERVE_MS : 0;
    const ms = deadline - Date.now() - reserve;
    const sending = ms > 0 ? sendBy(channels, channel, to, code) : null;
    if (sending === null) {
      // Out of time for this channel: the code was not sent, though the channel is set up.
      lastFailure = { code: 'unavailable' };
      continue;
    }
    const sent = await within(sending, ms);
    if (sent.ok) return ok({ channel, messageId: sent.value.messageId });
    lastFailure = sent.error;
  }
  return err(lastFailure);
}
