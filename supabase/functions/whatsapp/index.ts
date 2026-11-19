// The WhatsApp outbox consumer (#62, #86): the seat call when a member is called from the waitlist, a published promotion to members who opted in,
// what a member hears of while away (decision 0303) and the welcome once someone signs up (decision 0661), through the Evolution bridge for now (decision 0297). pg_cron runs it every minute (decision 0038);
// a messaging stop holds every send, and practice-venue events never reach it. The member's number
// is read from the database at send time, for the event's venue only, and never logged.
import { createWhatsAppConsumer, type FindErasedPhone, type FindRecipient } from '@rivr/adapters/messages';
import { indianMobileSchema } from '@rivr/contracts';
import { z } from 'zod';
import { isCallInForce, rpc, serveConsumer } from '../_shared/outbox.ts';
import { fenced, isWhatsAppOff, liveWhatsApp, whatsAppOff } from '../_shared/whatsapp.ts';

const recipientRows = z.array(z.object({
  phone: z.string(), marketing_opted_in_at: z.string().nullable(), first_name: z.string().min(1), member_number: z.number().int(),
}));

/**
 * The member's number, marketing opt-in, first name and member number at the event's venue, through the service role only; for a
 * promotion offer, only while the promotion still runs and may be offered to them (offer_recipient).
 */
const findRecipient: FindRecipient = async (venueId, memberId, offeredPromotionId) => {
  const found = offeredPromotionId === undefined
    ? await rpc('message_recipient', { p_venue_id: venueId, p_member_id: memberId })
    : await rpc('offer_recipient', { p_venue_id: venueId, p_member_id: memberId, p_promotion_id: offeredPromotionId });
  const row = recipientRows.parse(found)[0];
  const phone = indianMobileSchema.safeParse(row?.phone);
  if (!row || !phone.success) return null;
  return {
    phone: phone.data,
    marketingOptedInAt: row.marketing_opted_in_at === null ? null : new Date(row.marketing_opted_in_at),
    firstName: row.first_name,
    memberNumber: String(row.member_number),
  };
};

/** The number kept to say an account is deleted (decision 0574), through the service role only; null once it is forgotten. */
const findErasedPhone: FindErasedPhone = async (venueId, memberId) => {
  const phone = indianMobileSchema.safeParse(await rpc('erased_member_notice_phone', { p_venue_id: venueId, p_member_id: memberId }));
  return phone.success ? phone.data : null;
};

// Switched off (WHATSAPP_OFF=true), as on production, each message is taken and none is sent, so none waits in the outbox.
// With no secrets and not switched off, nothing is claimed: deliveries wait, and the 503 shows the fault. WhatsApp gets 10
// seconds, not the sign-in hook's 4, so a slow acceptance is not sent twice.
const whatsapp = liveWhatsApp(10_000);
Deno.serve(
  whatsapp || isWhatsAppOff()
    ? serveConsumer(createWhatsAppConsumer({ whatsapp: whatsapp ? fenced(whatsapp) : whatsAppOff, findRecipient, findErasedPhone, isCallInForce }))
    : () => Response.json({ error: 'WhatsApp is not configured' }, { status: 503 }),
);
