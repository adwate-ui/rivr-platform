// Supabase Auth's Send SMS hook: Auth generates a sign-in code and posts it here; this sends it by
// the WhatsApp authentication template, then SMS (docs/decisions/0025). The one place outside an
// outbox consumer that calls an adapter, because Auth waits for the code to go out. The code and
// the phone are never logged.
import { handleSendSmsHook, hookError, type HookReply } from '@rivr/adapters/sign-in-code';
import { createWhatsAppCloudApi } from '@rivr/adapters/whatsapp';
import { Webhook } from 'standardwebhooks';

// Auth signs each call (Standard Webhooks) with this secret, set on both sides. Auth stores it as
// `v1,whsec_<base64>`; the standardwebhooks library wants only the base64 part.
const secret = (Deno.env.get('SEND_SMS_HOOK_SECRET') ?? '').replace('v1,whsec_', '');

/** The channels whose credentials are set as function secrets. No SMS vendor is chosen yet. */
function liveChannels() {
  const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
  const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
  return { whatsapp: phoneNumberId && accessToken ? createWhatsAppCloudApi({ phoneNumberId, accessToken }) : undefined };
}

function reply({ status, body }: HookReply): Response {
  return Response.json(body, { status });
}

Deno.serve(async (request) => {
  // A caller that is not Auth gets a plain HTTP refusal and nothing else.
  if (request.method !== 'POST') return new Response(null, { status: 405 });
  // Auth is calling but the function cannot check it: refuse in a way the app can show.
  if (secret === '') return reply(hookError(500, 'Sign-in codes cannot be sent yet.'));
  let payload: unknown;
  try {
    // verify() reads the webhook-id, webhook-timestamp and webhook-signature headers, rejects a
    // timestamp more than five minutes old, and returns the parsed body only if the signature matches.
    payload = new Webhook(secret).verify(await request.text(), Object.fromEntries(request.headers));
  } catch {
    return new Response(null, { status: 401 });
  }
  return reply(await handleSendSmsHook(payload, liveChannels()));
});
