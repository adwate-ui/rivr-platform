// The WhatsApp outbox consumer (#62, #86): the seat call when a member is called from the waitlist, a published promotion to members who opted in, and
// the receipt-ready notice, through Meta's Cloud API. pg_cron runs it every minute (decision 0038);
// a messaging stop holds every send, and practice-venue events never reach it. The member's number
// is read from the database at send time, for the event's venue only, and never logged.
import { createWhatsAppCloudApi } from '@rivr/adapters/whatsapp';
import { createWhatsAppConsumer, type FindRecipient } from '@rivr/adapters/messages';
import { indianMobileSchema } from '@rivr/contracts';
import { z } from 'zod';
import { rpc, serveConsumer } from '../_shared/outbox.ts';

const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') ?? '';
const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN') ?? '';

const recipientRows = z.array(z.object({ phone: z.string(), marketing_opted_in_at: z.string().nullable() }));

/** The member's number and marketing opt-in at the event's venue, through the service role only. */
const findRecipient: FindRecipient = async (venueId, memberId) => {
  const row = recipientRows.parse(await rpc('message_recipient', { p_venue_id: venueId, p_member_id: memberId }))[0];
  const phone = indianMobileSchema.safeParse(row?.phone);
  if (!row || !phone.success) return null;
  return { phone: phone.data, marketingOptedInAt: row.marketing_opted_in_at === null ? null : new Date(row.marketing_opted_in_at) };
};

// Until WhatsApp is approved and its credentials set, nothing is claimed: deliveries wait, and a seat
// call whose hold has run out by then is handled unsent when it is claimed. Meta gets 10 seconds, not
// the sign-in hook's 4, so a slow acceptance is not sent twice.
Deno.serve(
  phoneNumberId && accessToken
    ? serveConsumer(createWhatsAppConsumer({ whatsapp: createWhatsAppCloudApi({ phoneNumberId, accessToken, timeoutMs: 10_000 }), findRecipient }))
    : () => Response.json({ error: 'WhatsApp is not configured' }, { status: 503 }),
);
