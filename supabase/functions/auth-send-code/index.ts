// Supabase Auth's Send SMS hook: Auth generates a sign-in code and posts it here; this sends it by
// the WhatsApp authentication template, then SMS (docs/decisions/0025). The one place outside an
// outbox consumer that calls an adapter, because Auth waits for the code to go out. The code and
// the phone are never logged.
import { handleSendSmsHook } from '@rivr/adapters/sign-in-code';
import { createWhatsAppCloudApi } from '@rivr/adapters/whatsapp';
import { Webhook } from 'standardwebhooks';

// Auth signs each call (Standard Webhooks) with this secret, set on both sides.
const secret = (Deno.env.get('SEND_SMS_HOOK_SECRET') ?? '').replace('v1,whsec_', '');

/** The channels whose credentials are set as function secrets. No SMS vendor is chosen yet (#179). */
function liveChannels() {
  const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
  const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
  return { whatsapp: phoneNumberId && accessToken ? createWhatsAppCloudApi({ phoneNumberId, accessToken }) : undefined };
}

function refuse(status: number, message: string): Response {
  return Response.json({ error: { http_code: status, message } }, { status });
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return refuse(405, 'Only Auth calls this function.');
  if (secret === '') return refuse(500, 'SEND_SMS_HOOK_SECRET is not set.');
  let payload: unknown;
  try {
    payload = new Webhook(secret).verify(await request.text(), Object.fromEntries(request.headers));
  } catch {
    return refuse(401, 'The hook signature did not verify.');
  }
  const { status, body } = await handleSendSmsHook(payload, liveChannels());
  return Response.json(body, { status });
});
