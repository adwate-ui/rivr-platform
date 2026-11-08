import { describe, expect, it } from 'vitest';
import type { SentMessage } from './consumers.ts';
import { toRow } from './rows.ts';

const BASE = { venueId: 'v1', delivered: true } as const;

describe('toRow', () => {
  it('reads a WhatsApp template message', () => {
    const sent: SentMessage = {
      ...BASE,
      channel: 'whatsapp',
      consumer: 'whatsapp',
      kind: 'waitlist.called',
      payload: { member_id: 'm1', table: 'Table 2' },
      message: { to: '+919000000211', template: 'seat_ready', params: ['Table 2', '10 minutes'], category: 'utility' },
    };
    expect(toRow(sent)).toMatchObject({
      recipient: '+919000000211',
      member_id: 'm1',
      body: 'seat_ready: Table 2 | 10 minutes',
      kind: 'waitlist.called',
    });
  });

  it('reads a push notification', () => {
    const sent: SentMessage = {
      ...BASE,
      channel: 'push',
      consumer: 'push',
      kind: 'bonus.redeemed',
      payload: { member_id: 'm2' },
      message: { subscription: { endpoint: 'https://push.example/1', keys: {} }, title: 'Bonus chips used', body: '200 chips', url: '/rewards', tag: 'b' },
    };
    expect(toRow(sent)).toMatchObject({ recipient: 'https://push.example/1', member_id: 'm2', body: 'Bonus chips used | 200 chips' });
  });

  it('keeps what it cannot read as nulls and empty words', () => {
    const sent: SentMessage = { ...BASE, channel: 'whatsapp', consumer: 'alert_whatsapp', kind: 'alert.raised', payload: null, message: {} };
    expect(toRow(sent)).toMatchObject({ recipient: null, member_id: null, body: ': ' });
  });
});
