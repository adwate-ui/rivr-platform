// The WhatsApp outbox consumer (#62): the seat call when a member is called from the waitlist, and
// the receipt-ready notice, through Meta's Cloud API. pg_cron runs it every minute (decision 0038);
// a messaging stop holds every send, and practice-venue events never reach it. The member's number
// is read from the database at send time and never logged.
import { createWhatsAppCloudApi, createWhatsAppConsumer, type FindRecipient } from '@rivr/adapters';
import { indianMobileSchema } from '@rivr/contracts';
import { z } from 'zod';
import { serveConsumer } from '../_shared/outbox.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') ?? '';
const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN') ?? '';

const recipientRow = z.array(z.object({ phone: z.string(), marketing_opted_in_at: z.string().nullable() }));

/** The member's number and marketing opt-in, through the service role only (private.message_recipient). */
const findRecipient: FindRecipient = async (memberId) => {
  const answer = await fetch(`${supabaseUrl}/rest/v1/rpc/message_recipient`, {
    method: 'POST',
    headers: { apikey: serviceRoleKey, authorization: `Bearer ${serviceRoleKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ p_member_id: memberId }),
  });
  // Thrown, so the delivery counts as unavailable and is tried again.
  if (!answer.ok) throw new Error(`message_recipient failed (${answer.status})`);
  const row = recipientRow.parse(await answer.json())[0];
  const phone = indianMobileSchema.safeParse(row?.phone);
  if (!row || !phone.success) return null;
  return { phone: phone.data, marketingOptedInAt: row.marketing_opted_in_at === null ? null : new Date(row.marketing_opted_in_at) };
};

// Until WhatsApp is approved and its credentials set, nothing is claimed: deliveries wait, and a seat
// call whose hold has expired by then is dropped as stale when it is finally claimed.
Deno.serve(
  phoneNumberId && accessToken
    ? serveConsumer(createWhatsAppConsumer({ whatsapp: createWhatsAppCloudApi({ phoneNumberId, accessToken }), findRecipient }))
    : () => Response.json({ error: 'WhatsApp is not configured' }, { status: 503 }),
);
