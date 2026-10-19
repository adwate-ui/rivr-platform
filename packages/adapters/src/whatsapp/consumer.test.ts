import { indianMobileSchema } from '@rivr/contracts';
import { describe, expect, it } from 'vitest';
import type { ClaimedDelivery } from '../outbox/index.ts';
import { createFakeWhatsApp } from './fake.ts';
import { createWhatsAppConsumer, type FindRecipient } from './consumer.ts';

const MEMBER = '00000000-0000-4000-8000-000000000211';
const phone = indianMobileSchema.parse('+919000000211');
const findRecipient: FindRecipient = async (memberId) => (memberId === MEMBER ? { phone, marketingOptedInAt: null } : null);

// Ten minutes before the hold in these calls runs out.
const now = () => new Date('2026-11-15T18:50:00Z');

function delivery(eventType: string, payload: unknown): ClaimedDelivery {
  return { deliveryId: 'd1', eventId: 'e1', venueId: 'v1', eventType, payload, attempts: 1 };
}

describe('the WhatsApp consumer', () => {
  it('is a messaging consumer of the seat call and the receipt notice, so a messaging stop holds it', () => {
    const consumer = createWhatsAppConsumer({ whatsapp: createFakeWhatsApp(), findRecipient, now });
    expect([consumer.name, consumer.isMessaging, consumer.eventTypes]).toEqual(['whatsapp', true, ['waitlist.called', 'receipt.ready']]);
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

  it('drops a seat call claimed after its hold ran out', async () => {
    const whatsapp = createFakeWhatsApp();
    const late = createWhatsAppConsumer({ whatsapp, findRecipient, now: () => new Date('2026-11-15T19:00:00Z') });
    const called = { member_id: MEMBER, table_name: 'Table 3', seat: 9, hold_until: '2026-11-15T19:00:00+00:00' };
    expect(await late.deliver(delivery('waitlist.called', called))).toEqual({ ok: false, error: { code: 'rejected', reason: 'the hold has expired' } });
    expect(whatsapp.calls).toEqual([]);
  });

  it('passes on WhatsApp\'s own failure, so the outbox retries it', async () => {
    const whatsapp = createFakeWhatsApp();
    whatsapp.failNext({ code: 'unavailable' });
    const consumer = createWhatsAppConsumer({ whatsapp, findRecipient, now });
    const called = { member_id: MEMBER, table_name: 'Table 3', seat: 9, hold_until: '2026-11-15T19:00:00+00:00' };
    expect(await consumer.deliver(delivery('waitlist.called', called))).toEqual({ ok: false, error: { code: 'unavailable' } });
  });
});
