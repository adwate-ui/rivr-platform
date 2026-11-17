import { describe, expect, it } from 'vitest';
import { createFakeEmail } from '../email/fake.ts';
import type { ClaimedDelivery } from '../outbox/index.ts';
import { createAlertEmailConsumer, type FindAlertEmails } from './alertEmailConsumer.ts';

const VENUE = 'v1';
const OWNERS = ['owner@example.com', 'gm@example.com'];
const OLD = '00000000-0000-4000-8000-0000000a1009';
const findAlertEmails: FindAlertEmails = async (venueId, alertId) => (alertId === OLD || venueId !== VENUE ? null : OWNERS);

function delivery(payload: unknown, venueId = VENUE): ClaimedDelivery {
  return { deliveryId: 'd1', eventId: 'e1', venueId, eventType: 'alert.raised', payload, attempts: 1 };
}

describe('the alert email consumer', () => {
  it('takes alert.raised, and is not held by a messaging stop', () => {
    const consumer = createAlertEmailConsumer({ email: createFakeEmail(), findAlertEmails });
    expect([consumer.name, consumer.isMessaging, consumer.eventTypes]).toEqual(['alert_email', false, ['alert.raised']]);
  });

  it('mails the alert\'s kind in words to the venue\'s alert addresses, and nothing more', async () => {
    const email = createFakeEmail();
    const done = await createAlertEmailConsumer({ email, findAlertEmails })
      .deliver(delivery({ alert_id: '00000000-0000-4000-8000-0000000a1001', kind: 'eod.variance' }));
    expect(done.ok).toBe(true);
    expect(email.calls).toEqual([{
      to: OWNERS, subject: 'RIVR alert: a cage shift closed with a variance', text: 'A cage shift closed with a variance.\n\nThe details are in the console.',
    }]);
  });

  it('sends nothing while email alerts are off, for another venue or for an alert raised more than a day ago', async () => {
    const email = createFakeEmail();
    const consumer = createAlertEmailConsumer({ email, findAlertEmails });
    expect(await consumer.deliver(delivery({ alert_id: OLD, kind: 'eod.variance' }))).toEqual({ ok: true, value: null });
    expect(await consumer.deliver(delivery({ alert_id: '00000000-0000-4000-8000-0000000a1002', kind: 'eod.variance' }, 'v2'))).toEqual({ ok: true, value: null });
    expect(email.calls).toEqual([]);
  });

  it('refuses a payload that is not an alert, never to retry it', async () => {
    const done = await createAlertEmailConsumer({ email: createFakeEmail(), findAlertEmails }).deliver(delivery({ nope: true }));
    expect(done).toEqual({ ok: false, error: { code: 'rejected', reason: 'alert.raised payload is not an alert' } });
  });
});
