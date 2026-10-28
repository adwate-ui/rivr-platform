import { describe, expect, it } from 'vitest';
import type { ClaimedDelivery } from '../outbox/index.ts';
import { createFakePush } from '../push/fake.ts';
import type { WebPushSubscription } from '../push/types.ts';
import { createPushConsumer, type FindPushTargets } from './pushConsumer.ts';

const MEMBER = '00000000-0000-4000-8000-000000000211';
const SESSION = '00000000-0000-4000-8000-0000000005e1';
const OTHER = '00000000-0000-4000-8000-0000000005e2';
const VENUE = 'v1';
const phone = (name: string): WebPushSubscription => ({ endpoint: `https://fcm.googleapis.com/fcm/send/${name}`, keys: { p256dh: 'BKabirP256dhKeyAAAAAAAAAAAA', auth: 'kabirAuth123' } });

// Ten minutes before the hold in these calls runs out.
const now = () => new Date('2026-11-15T18:50:00Z');

function delivery(eventType: string, payload: unknown, occurredAt?: Date): ClaimedDelivery {
  return { deliveryId: 'd1', eventId: 'e1', venueId: VENUE, eventType, payload, attempts: 1, ...(occurredAt ? { occurredAt } : {}) };
}

/** The member's phones for every kind but those turned off; what was asked, and what was forgotten. */
function members(phones: readonly WebPushSubscription[], off: readonly (string | null)[] = []) {
  const asked: (string | null)[] = [];
  const forgotten: string[] = [];
  const findTargets: FindPushTargets = async (venueId, memberId, pushType, promotionId) => {
    asked.push(promotionId === undefined ? pushType : `${String(pushType)} for ${promotionId}`);
    return venueId === VENUE && memberId === MEMBER && !off.includes(pushType) ? phones : [];
  };
  return { asked, forgotten, findTargets, forget: async (endpoint: string) => { forgotten.push(endpoint); } };
}

async function sendOne(eventType: string, payload: unknown) {
  const push = createFakePush();
  const targets = members([phone('a')]);
  const outcome = await createPushConsumer({ push, ...targets, now }).deliver(delivery(eventType, payload));
  return { outcome, sent: push.calls.map(({ title, body, url, tag }) => ({ title, body, url, tag })), asked: targets.asked };
}

describe('the push consumer', () => {
  it('is a messaging consumer of seat calls, call time, session reminders, withdrawals, tournaments and promotion offers', () => {
    const consumer = createPushConsumer({ push: createFakePush(), ...members([]), now });
    expect([consumer.name, consumer.isMessaging, consumer.eventTypes]).toEqual([
      'push', true, ['waitlist.called', 'call_time.completed', 'session.reminder', 'withdrawal.sent', 'tournament.starting', 'promotion.offered'],
    ]);
  });

  it('sends the seat call to each of the member\u2019s phones: the table, the seat and the hold, in IST', async () => {
    const push = createFakePush();
    const called = { member_id: MEMBER, table_name: 'Table 3', seat: 9, hold_until: '2026-11-15T19:00:00+00:00' };

    expect((await createPushConsumer({ push, ...members([phone('a'), phone('b')]), now }).deliver(delivery('waitlist.called', called))).ok).toBe(true);
    expect(push.calls).toEqual([phone('a'), phone('b')].map((subscription) => ({
      subscription, title: 'Your seat is ready', body: 'Table 3, seat 9. Hold until 00:30.', url: '/', tag: 'seat-ready',
    })));
  });

  it('words each kind, asking for the member\u2019s phones that want it', async () => {
    expect(await sendOne('call_time.completed', { member_id: MEMBER, session_id: SESSION, table_id: OTHER, seat: 4 })).toEqual({
      outcome: { ok: true, value: null }, asked: ['push.call_time_complete'],
      sent: [{ title: 'Call time done', body: 'Your call time is complete.', url: '/', tag: `call-time-${SESSION}` }],
    });
    expect(await sendOne('session.reminder', { member_id: MEMBER, session_id: SESSION, hours: 4 })).toEqual({
      outcome: { ok: true, value: null }, asked: [null],
      sent: [{ title: 'Session reminder', body: 'You have been playing for 4 hours.', url: '/', tag: `session-reminder-${SESSION}` }],
    });
    expect(await sendOne('withdrawal.sent', { member_id: MEMBER, withdrawal_request_id: OTHER, amount_paise: 1000000, utr: null, method: 'upi' })).toEqual({
      outcome: { ok: true, value: null }, asked: ['push.withdrawal_sent'],
      sent: [{ title: 'Withdrawal sent', body: '₹10,000 is on its way to you.', url: '/', tag: `withdrawal-${OTHER}` }],
    });
    expect(await sendOne('tournament.starting', { member_id: MEMBER, tournament_id: OTHER, name: 'RIVR Sunday' })).toEqual({
      outcome: { ok: true, value: null }, asked: ['push.tournament_starting'],
      sent: [{ title: 'RIVR Sunday is starting', body: 'The clock has started. Take your seat.', url: '/', tag: `tournament-${OTHER}` }],
    });
    const offer = { member_id: MEMBER, promotion_id: OTHER, title: 'Double points', detail: '2x points on every hour', runs: 'Tonight' };
    expect(await sendOne('promotion.offered', offer)).toEqual({
      outcome: { ok: true, value: null }, asked: [`push.promotion_published for ${OTHER}`],
      sent: [{ title: 'Double points', body: '2x points on every hour · Tonight', url: '/', tag: `promotion-${OTHER}` }],
    });
  });

  it('sends nothing to a member who does not want the kind, nor a seat call whose hold has run out', async () => {
    const push = createFakePush();
    const consumer = createPushConsumer({ push, ...members([phone('a')], ['push.seat_ready']), now });
    const called = { member_id: MEMBER, table_name: 'Table 3', seat: 9, hold_until: '2026-11-15T19:00:00+00:00' };
    expect((await consumer.deliver(delivery('waitlist.called', called))).ok).toBe(true);
    const late = createPushConsumer({ push, ...members([phone('a')]), now: () => new Date('2026-11-15T19:00:00Z') });
    expect((await late.deliver(delivery('waitlist.called', called))).ok).toBe(true);
    expect(push.calls).toEqual([]);
  });

  it('finishes unsent a push older than its kind is worth: an hour for call time and tournaments, a day for withdrawals', async () => {
    const push = createFakePush();
    const consumer = createPushConsumer({ push, ...members([phone('a')]), now });
    const hoursAgo = (hours: number) => new Date(now().getTime() - hours * 60 * 60 * 1000);
    const starting = { member_id: MEMBER, tournament_id: OTHER, name: 'RIVR Sunday' };
    const withdrawal = { member_id: MEMBER, withdrawal_request_id: OTHER, amount_paise: 1000000, utr: null, method: 'upi' };

    expect(await consumer.deliver(delivery('tournament.starting', starting, hoursAgo(2)))).toEqual({ ok: true, value: null });
    expect(await consumer.deliver(delivery('withdrawal.sent', withdrawal, hoursAgo(25)))).toEqual({ ok: true, value: null });
    expect(push.calls).toEqual([]);
    await consumer.deliver(delivery('tournament.starting', starting, hoursAgo(0.5)));
    await consumer.deliver(delivery('withdrawal.sent', withdrawal, hoursAgo(2)));
    expect(push.calls.map((call) => call.title)).toEqual(['RIVR Sunday is starting', 'Withdrawal sent']);
  });

  it('forgets a phone whose browser dropped its subscription, and still sends to the others', async () => {
    const push = createFakePush();
    const targets = members([phone('a'), phone('b')]);
    push.failNext({ code: 'subscription_gone' });
    const consumer = createPushConsumer({ push, ...targets, now });

    expect((await consumer.deliver(delivery('tournament.starting', { member_id: MEMBER, tournament_id: OTHER, name: 'RIVR Sunday' }))).ok).toBe(true);
    expect(targets.forgotten).toEqual(['https://fcm.googleapis.com/fcm/send/a']);
    expect(push.calls.map((call) => call.subscription.endpoint)).toEqual(['https://fcm.googleapis.com/fcm/send/a', 'https://fcm.googleapis.com/fcm/send/b']);
  });

  it('sends to each phone at once, so one failing does not stop the others', async () => {
    const push = createFakePush();
    push.failNext({ code: 'unavailable' });
    const consumer = createPushConsumer({ push, ...members([phone('a'), phone('b')]), now });
    expect(await consumer.deliver(delivery('tournament.starting', { member_id: MEMBER, tournament_id: OTHER, name: 'RIVR Sunday' })))
      .toEqual({ ok: false, error: { code: 'unavailable' } });
    expect(push.calls).toHaveLength(2);
  });

  it('fails a push service outage, to be tried again, and rejects an event it cannot read or does not send', async () => {
    const push = createFakePush();
    push.failNext({ code: 'unavailable' });
    const consumer = createPushConsumer({ push, ...members([phone('a')]), now });
    expect(await consumer.deliver(delivery('tournament.starting', { member_id: MEMBER, tournament_id: OTHER, name: 'RIVR Sunday' })))
      .toEqual({ ok: false, error: { code: 'unavailable' } });
    expect(await consumer.deliver(delivery('withdrawal.sent', { member_id: MEMBER })))
      .toEqual({ ok: false, error: { code: 'rejected', reason: 'withdrawal.sent payload is not readable' } });
    expect(await consumer.deliver(delivery('receipt.ready', {}))).toEqual({ ok: false, error: { code: 'rejected', reason: 'no push for receipt.ready' } });
  });
});
