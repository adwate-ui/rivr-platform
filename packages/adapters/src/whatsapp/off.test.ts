import { describe, expect, it } from 'vitest';
import { indianMobileSchema } from '@rivr/contracts';
import { createWhatsAppConsumer } from '../messages/consumer.ts';
import { whatsAppOff } from './off.ts';

const MEMBER = '00000000-0000-4000-8000-000000000211';
const phone = indianMobileSchema.parse('+919000000211');

describe('WhatsApp switched off', () => {
  it('takes a seat call, as any message, and sends it nowhere, so the delivery is done and nothing waits', async () => {
    const consumer = createWhatsAppConsumer({
      whatsapp: whatsAppOff,
      findRecipient: async () => ({ phone, marketingOptedInAt: null, firstName: 'Ishaan', memberNumber: '1042' }),
      findErasedPhone: async () => null,
      isCallInForce: async () => true,
      now: () => new Date('2026-11-15T18:50:00Z'),
    });
    const called = { member_id: MEMBER, table_name: 'Table 3', seat: 9, hold_until: '2026-11-15T19:00:00+00:00' };
    expect(await consumer.deliver({ deliveryId: 'd1', eventId: 'e1', venueId: 'v1', eventType: 'waitlist.called', payload: called, attempts: 1 }))
      .toEqual({ ok: true, value: { messageId: 'whatsapp-off' } });
  });
});
