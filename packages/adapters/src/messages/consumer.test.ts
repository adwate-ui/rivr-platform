import { indianMobileSchema } from '@rivr/contracts';
import { describe, expect, it } from 'vitest';
import type { ClaimedDelivery } from '../outbox/index.ts';
import { createFakeWhatsApp } from '../whatsapp/fake.ts';
import { createWhatsAppConsumer, type FindRecipient } from './consumer.ts';

const MEMBER = '00000000-0000-4000-8000-000000000211';
const phone = indianMobileSchema.parse('+919000000211');
const VENUE = 'v1';
const findRecipient: FindRecipient = async (venueId, memberId) =>
  (venueId === VENUE && memberId === MEMBER ? { phone, marketingOptedInAt: null } : null);

// Ten minutes before the hold in these calls runs out.
const now = () => new Date('2026-11-15T18:50:00Z');

function delivery(eventType: string, payload: unknown): ClaimedDelivery {
  return { deliveryId: 'd1', eventId: 'e1', venueId: VENUE, eventType, payload, attempts: 1 };
}

describe('the WhatsApp consumer', () => {
  it('is a messaging consumer of the seat call, the receipt notice, promotion offers and review requests, so a messaging stop holds it', () => {
    const consumer = createWhatsAppConsumer({ whatsapp: createFakeWhatsApp(), findRecipient, now });
    expect([consumer.name, consumer.isMessaging, consumer.eventTypes]).toEqual(['whatsapp', true, ['waitlist.called', 'receipt.ready', 'promotion.offered', 'review.requested']]);
  });

  it('sends the seat call: the table, the seat and when the hold expires, in IST', async () => {
    const whatsapp = createFakeWhatsApp();
    const consumer = createWhatsAppConsumer({ whatsapp, findRecipient, now });
    const called = { member_id: MEMBER, table_name: 'Table 3', seat: 9, hold_until: '2026-11-15T19:00:00+00:00' };

    expect((await consumer.deliver(delivery('waitlist.called', called))).ok).toBe(true);
    expect(whatsapp.calls).toEqual([{ category: 'utility', to: phone, template: 'seat_ready', params: ['Table 3', '9', '00:30'] }]);
  });

  it('sends the receipt notice with the amount, and its link on the button', async () => {
    const whatsapp = createFakeWhatsApp();
    const consumer = createWhatsAppConsumer({ whatsapp, findRecipient, now });

    await consumer.deliver(delivery('receipt.ready', { member_id: MEMBER, amount_paise: 1000000, link: 'r/ab12' }));
    expect(whatsapp.calls).toEqual([{ category: 'utility', to: phone, template: 'receipt_ready', params: ['₹10,000'], urlButton: 'r/ab12' }]);
  });

  it('rejects, for good, a payload it cannot read, a member no longer there, or an event it does not send', async () => {
    const whatsapp = createFakeWhatsApp();
    const consumer = createWhatsAppConsumer({ whatsapp, findRecipient, now });
    const gone = { member_id: '00000000-0000-4000-8000-000000000999', table_name: 'Table 3', seat: 9, hold_until: '2026-11-15T19:00:00+00:00' };

    expect(await consumer.deliver(delivery('waitlist.called', { member_id: MEMBER }))).toMatchObject({ ok: false, error: { code: 'rejected' } });
    expect(await consumer.deliver(delivery('waitlist.called', gone))).toMatchObject({ ok: false, error: { code: 'rejected' } });
    expect(await consumer.deliver(delivery('receipt.ready', { member_id: MEMBER, amount_paise: 100, link: 'https://evil.example' }))).toMatchObject({
      ok: false, error: { code: 'rejected' },
    });
    expect(await consumer.deliver(delivery('seat.taken', {}))).toMatchObject({ ok: false, error: { code: 'rejected' } });
    expect(whatsapp.calls).toEqual([]);
  });

  it('handles a seat call claimed after its hold ran out without sending it, and without failing it', async () => {
    const whatsapp = createFakeWhatsApp();
    const late = createWhatsAppConsumer({ whatsapp, findRecipient, now: () => new Date('2026-11-15T19:00:00Z') });
    const called = { member_id: MEMBER, table_name: 'Table 3', seat: 9, hold_until: '2026-11-15T19:00:00+00:00' };
    expect(await late.deliver(delivery('waitlist.called', called))).toEqual({ ok: true, value: null });
    expect(whatsapp.calls).toEqual([]);
  });

  it('finds the member only at the event\'s venue', async () => {
    const whatsapp = createFakeWhatsApp();
    const consumer = createWhatsAppConsumer({ whatsapp, findRecipient, now });
    const called = { member_id: MEMBER, table_name: 'Table 3', seat: 9, hold_until: '2026-11-15T19:00:00+00:00' };
    expect(await consumer.deliver({ ...delivery('waitlist.called', called), venueId: 'elsewhere' })).toMatchObject({ ok: false, error: { code: 'rejected' } });
    expect(whatsapp.calls).toEqual([]);
  });

  it('passes on WhatsApp\'s own failure, so the outbox retries it', async () => {
    const whatsapp = createFakeWhatsApp();
    whatsapp.failNext({ code: 'unavailable' });
    const consumer = createWhatsAppConsumer({ whatsapp, findRecipient, now });
    const called = { member_id: MEMBER, table_name: 'Table 3', seat: 9, hold_until: '2026-11-15T19:00:00+00:00' };
    expect(await consumer.deliver(delivery('waitlist.called', called))).toEqual({ ok: false, error: { code: 'unavailable' } });
  });

  it('asks for a Google review as a marketing message, with the venue\'s link, only to a member who opted in', async () => {
    const optedIn = new Date('2026-10-01T10:00:00Z');
    const whatsapp = createFakeWhatsApp();
    const review = { review_request_id: '00000000-0000-4000-8000-000000000b01', member_id: MEMBER, url: 'https://g.page/r/rivr-gurugram/review' };

    const asking = createWhatsAppConsumer({ whatsapp, now, findRecipient: async () => ({ phone, marketingOptedInAt: optedIn }) });
    expect((await asking.deliver(delivery('review.requested', review))).ok).toBe(true);
    expect(whatsapp.calls).toEqual([{ category: 'marketing', optedInAt: optedIn, to: phone, template: 'review_request', params: [review.url] }]);

    const notOptedIn = createWhatsAppConsumer({ whatsapp, findRecipient, now });
    expect(await notOptedIn.deliver(delivery('review.requested', review))).toEqual({ ok: true, value: null });
    expect(await notOptedIn.deliver(delivery('review.requested', { ...review, url: 'http://insecure.example' }))).toMatchObject({ ok: false });
    expect(whatsapp.calls).toHaveLength(1);
  });

  it('sends a promotion offer as the marketing template, with the member\'s opt-in, and nothing once they opted out or it stopped running (#86)', async () => {
    const optedIn = new Date('2026-10-01T10:00:00Z');
    const whatsapp = createFakeWhatsApp();
    const asked: (string | undefined)[] = [];
    const consumer = createWhatsAppConsumer({ whatsapp, now, findRecipient: async (_venueId, _memberId, offeredPromotionId) => {
      asked.push(offeredPromotionId);
      return { phone, marketingOptedInAt: optedIn };
    } });
    const offer = { promotion_id: '00000000-0000-4000-8000-000000000a01', member_id: MEMBER, title: 'Double points', detail: null, runs: 'NLH 100/200 · Thursday, 14:00 to 20:00' };

    expect((await consumer.deliver(delivery('promotion.offered', offer))).ok).toBe(true);
    expect(whatsapp.calls).toEqual([{ category: 'marketing', optedInAt: optedIn, to: phone, template: 'promotion', params: ['Double points · NLH 100/200 · Thursday, 14:00 to 20:00.'] }]);
    // The member is found for the offer's own promotion, so one no longer running finds nobody.
    expect(asked).toEqual([offer.promotion_id]);

    const withdrawn = createWhatsAppConsumer({ whatsapp, findRecipient, now });
    expect(await withdrawn.deliver(delivery('promotion.offered', offer))).toEqual({ ok: true, value: null });
    expect(await withdrawn.deliver(delivery('promotion.offered', { ...offer, title: '' }))).toMatchObject({ ok: false });
    const stopped = createWhatsAppConsumer({ whatsapp, now, findRecipient: async () => null });
    expect(await stopped.deliver(delivery('promotion.offered', offer))).toEqual({ ok: true, value: null });
    expect(whatsapp.calls).toHaveLength(1);
  });
});
