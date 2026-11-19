// Which WhatsApp the functions send through (decision 0297): the Evolution bridge while its three secrets are set,
// else Meta's Cloud API once its two are, else none, and nothing is sent. Shared by the sign-in code hook and the
// two WhatsApp consumers.
import { createWhatsAppCloudApi, createWhatsAppEvolution, fencedWhatsApp, whatsAppOff, type WhatsAppAdapter } from '@rivr/adapters/whatsapp';

export { whatsAppOff };

const secret = (name: string): string => Deno.env.get(name) ?? '';

/**
 * WhatsApp switched off on purpose with `WHATSAPP_OFF=true`, as on production, which has none (the owner, 19 Nov 2026,
 * decision 0697). Missing secrets alone are a fault, not a switch: the consumers then answer 503 and deliveries wait.
 */
export const isWhatsAppOff = (): boolean => secret('WHATSAPP_OFF') === 'true';

/** The WhatsApp whose secrets are set, waiting at most `timeoutMs` for each send; undefined while none is, or it is switched off. */
export function liveWhatsApp(timeoutMs: number): WhatsAppAdapter | undefined {
  if (isWhatsAppOff()) return undefined;
  const [baseUrl, apiKey, instance] = [secret('EVOLUTION_API_URL'), secret('EVOLUTION_API_KEY'), secret('EVOLUTION_INSTANCE_NAME')];
  // Only over https: the key and every code would otherwise cross the internet readable.
  if (baseUrl.startsWith('https://') && apiKey && instance) return createWhatsAppEvolution({ baseUrl, apiKey, instance, timeoutMs });
  const [phoneNumberId, accessToken] = [secret('WHATSAPP_PHONE_NUMBER_ID'), secret('WHATSAPP_ACCESS_TOKEN')];
  if (phoneNumberId && accessToken) return createWhatsAppCloudApi({ phoneNumberId, accessToken, timeoutMs });
  return undefined;
}

/** Staging's fence for the consumers (`WHATSAPP_ALLOWLIST`); a sign-in code is never fenced: it goes to the phone that asked. */
export const fenced = (whatsapp: WhatsAppAdapter): WhatsAppAdapter => fencedWhatsApp(whatsapp, secret('WHATSAPP_ALLOWLIST'));
