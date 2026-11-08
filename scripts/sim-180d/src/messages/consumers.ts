/**
 * The real outbox consumers, run in Node on the simulation's clock with the recording fakes in place of
 * WhatsApp and web push. The lookups are Node copies of the ones in supabase/functions/{whatsapp,alert-whatsapp,
 * push}/index.ts, which run only under Deno. Keep them in step.
 */
import { createFakePush, createFakeWhatsApp, type Consumer } from '@rivr/adapters';
import {
  createAlertConsumer,
  createPushConsumer,
  createWhatsAppConsumer,
  type FindAlertNumber,
  type FindPushTargets,
  type FindRecipient,
} from '@rivr/adapters/messages';
import { indianMobileSchema } from '@rivr/contracts';
import { z } from 'zod';
import type { Rpc } from './store.ts';

/** One message a consumer sent, with the event that caused it, for sim.message. */
export interface SentMessage {
  channel: 'whatsapp' | 'push';
  consumer: string;
  /** The event type: waitlist.called, alert.raised, bonus.redeemed and so on. */
  kind: string;
  venueId: string;
  /** The event's payload, which names the member it is about. */
  payload: unknown;
  /** What the fake received: a WhatsApp template message or a push notification. */
  message: unknown;
  delivered: boolean;
}

const recipientRows = z.array(z.object({ phone: z.string(), marketing_opted_in_at: z.string().nullable() }));
const numberRows = z.array(z.object({ alert_whatsapp: z.string().nullable() }));
const targetRows = z.array(z.object({ endpoint: z.string(), p256dh: z.string(), auth: z.string() }));

function findRecipientWith(rpc: Rpc): FindRecipient {
  return async (venueId, memberId, offeredPromotionId) => {
    const found =
      offeredPromotionId === undefined
        ? await rpc('message_recipient', { p_venue_id: venueId, p_member_id: memberId })
        : await rpc('offer_recipient', { p_venue_id: venueId, p_member_id: memberId, p_promotion_id: offeredPromotionId });
    const row = recipientRows.parse(found)[0];
    const phone = indianMobileSchema.safeParse(row?.phone);
    if (!row || !phone.success) return null;
    return { phone: phone.data, marketingOptedInAt: row.marketing_opted_in_at === null ? null : new Date(row.marketing_opted_in_at) };
  };
}

function findAlertNumberWith(rpc: Rpc): FindAlertNumber {
  return async (venueId, alertId) => {
    const row = numberRows.parse(await rpc('alert_recipient', { p_venue_id: venueId, p_alert_id: alertId }))[0];
    const phone = indianMobileSchema.safeParse(row?.alert_whatsapp);
    return phone.success ? phone.data : null;
  };
}

function findTargetsWith(rpc: Rpc): FindPushTargets {
  return async (venueId, memberId, pushType, promotionId) =>
    targetRows
      .parse(await rpc('push_targets', { p_venue_id: venueId, p_member_id: memberId, p_push_type: pushType, p_promotion_id: promotionId ?? null }))
      .map((row) => ({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }));
}

/** The consumer, unchanged, except that every message its fake received is also written to the sink. */
function recorded(consumer: Consumer, channel: SentMessage['channel'], calls: () => readonly unknown[], sink: SentMessage[]): Consumer {
  return {
    name: consumer.name,
    eventTypes: consumer.eventTypes,
    isMessaging: consumer.isMessaging,
    async deliver(delivery) {
      const before = calls().length;
      const outcome = await consumer.deliver(delivery);
      for (const message of calls().slice(before)) {
        sink.push({ channel, consumer: consumer.name, kind: delivery.eventType, venueId: delivery.venueId, payload: delivery.payload, message, delivered: outcome.ok });
      }
      return outcome;
    },
  };
}

/** The WhatsApp, alert and push consumers, each with its own recording fake, reading the time from `now`. */
export function createSimConsumers(rpc: Rpc, now: () => Date): { consumers: Consumer[]; sent: SentMessage[] } {
  const sent: SentMessage[] = [];
  const whatsapp = createFakeWhatsApp({ now });
  const alerts = createFakeWhatsApp({ now });
  const push = createFakePush();
  const forget = async (endpoint: string): Promise<void> => {
    await rpc('forget_push_subscription', { p_endpoint: endpoint });
  };
  return {
    sent,
    consumers: [
      recorded(createWhatsAppConsumer({ whatsapp, findRecipient: findRecipientWith(rpc), now }), 'whatsapp', () => whatsapp.calls, sent),
      recorded(createAlertConsumer({ whatsapp: alerts, findAlertNumber: findAlertNumberWith(rpc) }), 'whatsapp', () => alerts.calls, sent),
      recorded(createPushConsumer({ push, findTargets: findTargetsWith(rpc), forget, now }), 'push', () => push.calls, sent),
    ],
  };
}
