// Supabase Auth's Send SMS hook: Auth generates a sign-in code and posts it here; this sends it by
// the WhatsApp authentication template, then SMS (docs/decisions/0025), or SMS first for a second
// code to a number within ten minutes (#181). The one place outside an outbox consumer that calls an
// adapter, because Auth waits for the code to go out. The code and the phone are never logged.
import { handleSendSmsHook, hookError, type HookReply, type NoteSignInCodeSend } from '@rivr/adapters/sign-in-code';
import { createMsg91SmsOtp } from '@rivr/adapters/sms-otp';
import { createWhatsAppCloudApi } from '@rivr/adapters/whatsapp';
import { Webhook } from 'standardwebhooks';

// Auth signs each call (Standard Webhooks) with this secret, set on both sides. Auth stores it as
// `v1,whsec_<base64>`; the standardwebhooks library wants only the base64 part.
const secret = (Deno.env.get('SEND_SMS_HOOK_SECRET') ?? '').replace('v1,whsec_', '');

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

/** The channels whose credentials are set as function secrets: WhatsApp, and SMS through MSG91. */
function liveChannels() {
  const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
  const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
  const authKey = Deno.env.get('MSG91_AUTH_KEY');
  const templateId = Deno.env.get('MSG91_TEMPLATE_ID');
  return {
    whatsapp: phoneNumberId && accessToken ? createWhatsAppCloudApi({ phoneNumberId, accessToken }) : undefined,
    smsOtp: authKey && templateId ? createMsg91SmsOtp({ authKey, templateId }) : undefined,
  };
}

/**
 * Notes the send in the database (a keyed hash of the number and the time) and says whether a code
 * went to the number in the last ten minutes. If the database cannot answer in time, it is a first send.
 */
const noteSend: NoteSignInCodeSend = async (to) => {
  try {
    const answer = await fetch(`${supabaseUrl}/rest/v1/rpc/note_sign_in_code_send`, {
      method: 'POST',
      headers: { apikey: serviceRoleKey, authorization: `Bearer ${serviceRoleKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ p_phone: to }),
      signal: AbortSignal.timeout(500),
    });
    return answer.ok && (await answer.json()) === true;
  } catch {
    return false;
  }
};

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
  return reply(await handleSendSmsHook(payload, liveChannels(), noteSend));
});
