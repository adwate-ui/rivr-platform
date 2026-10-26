import { indianMobileSchema } from '@rivr/contracts';
import { alerts } from '@rivr/i18n';
import { describe, expect, it } from 'vitest';
import type { ClaimedDelivery } from '../outbox/index.ts';
import { createFakeWhatsApp } from '../whatsapp/fake.ts';
import { createAlertConsumer, type FindAlertNumber } from './alertConsumer.ts';

const VENUE = 'v1';
const owner = indianMobileSchema.parse('+919000000901');
const OLD = '00000000-0000-4000-8000-0000000a1009';
const findAlertNumber: FindAlertNumber = async (venueId, alertId) => (venueId === VENUE && alertId !== OLD ? owner : null);

function delivery(payload: unknown, venueId = VENUE): ClaimedDelivery {
  return { deliveryId: 'd1', eventId: 'e1', venueId, eventType: 'alert.raised', payload, attempts: 1 };
}

describe('the alert consumer', () => {
  it('takes alert.raised, and is not held by a messaging stop, as the owner answered', () => {
    const consumer = createAlertConsumer({ whatsapp: createFakeWhatsApp(), findAlertNumber });
    expect([consumer.name, consumer.isMessaging, consumer.eventTypes]).toEqual(['alert_whatsapp', false, ['alert.raised']]);
  });

  it('sends the alert\'s kind in words to the venue\'s alert number, and nothing more', async () => {
    const whatsapp = createFakeWhatsApp();
    const consumer = createAlertConsumer({ whatsapp, findAlertNumber });
    const done = await consumer.deliver(delivery({ alert_id: '00000000-0000-4000-8000-0000000a1001', kind: 'eod.variance' }));
    expect(done.ok).toBe(true);
    expect(whatsapp.calls).toEqual([{ category: 'utility', to: owner, template: 'owner_alert', params: ['a cage shift closed with a variance'] }]);
  });

  it('says only that something needs attention for a kind it does not know', async () => {
    const whatsapp = createFakeWhatsApp();
    await createAlertConsumer({ whatsapp, findAlertNumber }).deliver(delivery({ alert_id: '00000000-0000-4000-8000-0000000a1002', kind: 'new.kind' }));
    expect(whatsapp.calls[0]?.params).toEqual(['something needs your attention']);
  });

  it('sends nothing, and nothing is wrong, for a venue with no alert number', async () => {
    const whatsapp = createFakeWhatsApp();
    const done = await createAlertConsumer({ whatsapp, findAlertNumber }).deliver(delivery({ alert_id: '00000000-0000-4000-8000-0000000a1003', kind: 'eod.variance' }, 'v2'));
    expect(done).toEqual({ ok: true, value: null });
    expect(whatsapp.calls).toEqual([]);
  });

  it('sends nothing for an alert raised more than a day ago', async () => {
    const whatsapp = createFakeWhatsApp();
    const done = await createAlertConsumer({ whatsapp, findAlertNumber }).deliver(delivery({ alert_id: OLD, kind: 'eod.variance' }));
    expect(done).toEqual({ ok: true, value: null });
    expect(whatsapp.calls).toEqual([]);
  });

  it('refuses a payload that is not an alert, for good', async () => {
    const done = await createAlertConsumer({ whatsapp: createFakeWhatsApp(), findAlertNumber }).deliver(delivery({ kind: 'eod.variance', phone: '+919000000211' }));
    expect(done).toEqual({ ok: false, error: { code: 'rejected', reason: 'alert.raised payload is not an alert' } });
  });

  it('knows every kind the database raises, in words', () => {
    expect(Object.values(alerts.kinds).every((words) => words.length > 0 && !/\d/.test(words))).toBe(true);
  });
});
