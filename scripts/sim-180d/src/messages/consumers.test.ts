import type { ClaimedDelivery } from '@rivr/adapters';
import { describe, expect, it } from 'vitest';
import { createSimConsumers, type SentMessage } from './consumers.ts';
import type { Rpc } from './store.ts';

const VENUE = '00000000-0000-4000-8000-000000000001';
const ALERT = '00000000-0000-4000-8000-0000000000a1';
const NOW = new Date('2026-11-15T14:00:00Z');

function rpcAnswering(answers: Record<string, unknown>): Rpc {
  return async (name) => {
    if (!(name in answers)) throw new Error(`unexpected rpc ${name}`);
    return answers[name];
  };
}

function alertDelivery(kind: string): ClaimedDelivery {
  return {
    deliveryId: 'd1',
    eventId: 'e1',
    venueId: VENUE,
    eventType: 'alert.raised',
    payload: { alert_id: ALERT, kind },
    attempts: 1,
    occurredAt: NOW,
  };
}

function alertConsumer(rpc: Rpc): { deliver: (d: ClaimedDelivery) => Promise<{ ok: boolean }>; sent: SentMessage[] } {
  const { consumers, sent } = createSimConsumers(rpc, () => NOW);
  const consumer = consumers.find((each) => each.name === 'alert_whatsapp');
  if (!consumer) throw new Error('no alert consumer');
  return { deliver: (delivery) => consumer.deliver(delivery), sent };
}

describe('createSimConsumers', () => {
  it('builds the WhatsApp, alert and push consumers', () => {
    const { consumers } = createSimConsumers(rpcAnswering({}), () => NOW);
    expect(consumers.map((consumer) => consumer.name)).toEqual(['whatsapp', 'alert_whatsapp', 'push']);
  });

  it('records the message an alert sends to the venue alert number', async () => {
    const { deliver, sent } = alertConsumer(rpcAnswering({ alert_recipient: [{ alert_whatsapp: '+919999000001' }] }));
    const outcome = await deliver(alertDelivery('outbox.silent'));
    expect(outcome.ok).toBe(true);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ channel: 'whatsapp', consumer: 'alert_whatsapp', kind: 'alert.raised', venueId: VENUE, delivered: true });
    expect(sent[0]?.message).toMatchObject({ to: '+919999000001', template: 'owner_alert' });
  });

  it('records nothing when the venue has no alert number', async () => {
    const { deliver, sent } = alertConsumer(rpcAnswering({ alert_recipient: [{ alert_whatsapp: null }] }));
    expect((await deliver(alertDelivery('outbox.silent'))).ok).toBe(true);
    expect(sent).toEqual([]);
  });
});
