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

/** What `within` gives for a send still running when its time is up. */
const LATE = Symbol('late');

/** The send's result, or `LATE` if it has not finished within `ms`; its request is left to end on its own. */
async function within<T>(send: Promise<Result<T, AdapterFailure>>, ms: number): Promise<Result<T, AdapterFailure> | typeof LATE> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<typeof LATE>((resolve) => {
    timer = setTimeout(() => resolve(LATE), ms);
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
  /** Given each send still running when its time is up, so its request can finish after the reply (EdgeRuntime.waitUntil). */
  readonly keepAlive?: ((send: Promise<unknown>) => void) | undefined;
}

interface ChannelTry {
  readonly to: IndianMobile;
  readonly code: string;
  /** How long this channel may take. */
  readonly ms: number;
  /** No channel is left to try after this one. */
  readonly last: boolean;
  readonly keepAlive: SignInCodeToSend['keepAlive'];
}

/** Sends by one channel within `ms`. */
async function tryChannel(
  channels: SignInCodeChannels,
  channel: SignInCodeSent['channel'],
  { to, code, ms, last, keepAlive }: ChannelTry,
): Promise<Result<SignInCodeSent, AdapterFailure>> {
  const sending = ms > 0 ? sendBy(channels, channel, to, code) : null;
  // Out of time for this channel: the code was not sent, though the channel is set up.
  if (sending === null) return err({ code: 'unavailable' });
  const sent = await within(sending, ms);
  if (sent !== LATE) return sent.ok ? ok({ channel, messageId: sent.value.messageId }) : err(sent.error);
  keepAlive?.(sending);
  // The vendor has the request and may deliver after answering late, as the Evolution bridge does
  // (4 s and more). With no channel left to try, counting it as sent lets the member enter a code
  // that arrives; one that never does brings them back for another, which goes by SMS first (#181).
  return last ? ok({ channel, messageId: 'unknown' }) : err({ code: 'unavailable' });
}

/**
 * Sends a sign-in code: the WhatsApp authentication template first, SMS when WhatsApp fails or is
 * not configured (scope-v1, module 1); `preferSms` turns the order round. Both fit before
 * `deadline`: the first channel leaves `FALLBACK_RESERVE_MS` for the second. With no channel
 * configured it fails closed with `not_configured`: a fake must never report a code as sent to a
 * real person. The last channel, still sending at the deadline, counts as sent (decision 0304).
 */
export async function sendSignInCode(
  channels: SignInCodeChannels,
  { to, code, preferSms = false, deadline = Date.now() + SEND_BUDGET_MS, keepAlive }: SignInCodeToSend,
): Promise<Result<SignInCodeSent, AdapterFailure>> {
  const order: SignInCodeSent['channel'][] = preferSms ? ['sms', 'whatsapp'] : ['whatsapp', 'sms'];
  const configured = order.filter((channel) => (channel === 'whatsapp' ? channels.whatsapp : channels.smsOtp) !== undefined);
  // Stays not_configured if no channel is tried; otherwise the last channel's failure is reported.
  let lastFailure: AdapterFailure = { code: 'not_configured' };
  for (const [index, channel] of configured.entries()) {
    const last = index === configured.length - 1;
    const ms = deadline - Date.now() - (last ? 0 : FALLBACK_RESERVE_MS);
    const sent = await tryChannel(channels, channel, { to, code, ms, last, keepAlive });
    if (sent.ok) return sent;
    lastFailure = sent.error;
  }
  return err(lastFailure);
}
