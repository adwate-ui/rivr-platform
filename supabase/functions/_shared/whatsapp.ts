// Which WhatsApp the functions send through (decision 0297): the Evolution bridge while its three secrets are set,
// else Meta's Cloud API once its two are, else none, and nothing is sent. Shared by the sign-in code hook and the
// two WhatsApp consumers.
import { createWhatsAppCloudApi, createWhatsAppEvolution, fencedWhatsApp, type WhatsAppAdapter } from '@rivr/adapters/whatsapp';

const secret = (name: string): string => Deno.env.get(name) ?? '';

/** The WhatsApp whose secrets are set, waiting at most `timeoutMs` for each send; undefined while none is. */
export function liveWhatsApp(timeoutMs: number): WhatsAppAdapter | undefined {
  const [baseUrl, apiKey, instance] = [secret('EVOLUTION_API_URL'), secret('EVOLUTION_API_KEY'), secret('EVOLUTION_INSTANCE_NAME')];
  // Only over https: the key and every code would otherwise cross the internet readable.
  if (baseUrl.startsWith('https://') && apiKey && instance) return createWhatsAppEvolution({ baseUrl, apiKey, instance, timeoutMs });
  const [phoneNumberId, accessToken] = [secret('WHATSAPP_PHONE_NUMBER_ID'), secret('WHATSAPP_ACCESS_TOKEN')];
  if (phoneNumberId && accessToken) return createWhatsAppCloudApi({ phoneNumberId, accessToken, timeoutMs });
  return undefined;
}

/** Staging's fence for the consumers (`WHATSAPP_ALLOWLIST`); a sign-in code is never fenced: it goes to the phone that asked. */
export const fenced = (whatsapp: WhatsAppAdapter): WhatsAppAdapter => fencedWhatsApp(whatsapp, secret('WHATSAPP_ALLOWLIST'));
