import { describe, expect, it } from 'vitest';
import { createFakeLiveStatus } from '../live-status/fake.ts';
import type { LiveStatusDevice } from '../live-status/types.ts';
import type { ClaimedDelivery } from '../outbox/index.ts';
import { createLiveStatusConsumer, type LiveStatusFacts, type LiveStatusTarget } from './liveStatusConsumer.ts';

const MEMBER = '00000000-0000-4000-8000-000000000211';
const ENTRY = '00000000-0000-4000-8000-0000000005e1';
const LIST = '00000000-0000-4000-8000-0000000005e2';
const VENUE = 'v1';

function delivery(eventType: string, payload: unknown): ClaimedDelivery {
  return { deliveryId: 'd1', eventId: 'e1', venueId: VENUE, eventType, payload, attempts: 1 };
}
const moved = delivery('waitlist.moved', { entry_id: ENTRY, member_id: MEMBER, table_type_id: LIST });
const seatTaken = delivery('seat.taken', { member_id: MEMBER, table_id: LIST, seat: 4 });

const android = (name: string): LiveStatusDevice => ({ platform: 'android', token: `${name}:APA91bHPRgkF3JUikC4ENAH`, activityToken: null });

const NOTHING: LiveStatusFacts = {
  state: null, entryId: null, tableName: null, seat: null, game: null, place: null, startsAt: null, endsAt: null, canOrder: false,
};
const waitingAt = (place: number | null, tableName: string | null = 'Table 5'): LiveStatusFacts => ({
  ...NOTHING, state: 'waiting', entryId: ENTRY, tableName, game: 'NLH 50/100', place,
});
const SEAT_READY: LiveStatusFacts = {
  ...NOTHING, state: 'seat_ready', entryId: ENTRY, tableName: 'Table 5', seat: 4, game: 'NLH 50/100', place: 1,
  startsAt: '2026-11-15T16:05:00+00:00', endsAt: '2026-11-15T16:25:00+00:00',
};
const SEATED: LiveStatusFacts = {
  ...NOTHING, state: 'seated', tableName: 'Table 1', seat: 4, game: 'NLH 50/100', startsAt: '2026-11-15T15:00:00+00:00',
  endsAt: '2026-11-15T18:00:00+00:00', canOrder: true,
};

function target(facts: LiveStatusFacts, deviceId = 'phone-1', shown: string | null = null): LiveStatusTarget {
  return { deviceId, device: android(deviceId), shown, facts };
}

/** The phones an event reaches; what was asked for, noted as shown and forgotten. */
function phones(targets: readonly LiveStatusTarget[]) {
  const asked: { memberId: string; tableTypeId: string | null }[] = [];
  const noted: [string, string | null][] = [];
  const forgotten: string[] = [];
  return {
    asked, noted, forgotten,
    findTargets: async (venueId: string, memberId: string, tableTypeId: string | null) => {
      asked.push({ memberId, tableTypeId });
      return venueId === VENUE ? targets : [];
    },
    noteShown: async (deviceId: string, shown: string | null) => { noted.push([deviceId, shown]); },
    forget: async (deviceId: string) => { forgotten.push(deviceId); },
  };
}

async function show(targets: readonly LiveStatusTarget[], event = seatTaken) {
  const liveStatus = createFakeLiveStatus();
  const found = phones(targets);
  const outcome = await createLiveStatusConsumer({ liveStatus, ...found }).deliver(event);
  return { outcome, ...found, statuses: liveStatus.calls.map((call) => call.status) };
}

describe('the live-status consumer', () => {
  it('is a messaging consumer of the list’s moves, seat calls, seats and call time (decision 0323)', () => {
    const consumer = createLiveStatusConsumer({ liveStatus: createFakeLiveStatus(), ...phones([]) });
    expect([consumer.name, consumer.isMessaging, consumer.eventTypes]).toEqual([
      'live_status', true,
      ['waitlist.moved', 'waitlist.called', 'seat.taken', 'seat.moved', 'seat.away', 'seat.back', 'seat.left', 'call_time.updated', 'call_time.ending',
        'call_time.completed'],
    ]);
  });

  it('shows a place in words: Next in line, 2nd in line or Requested, under the table asked for, beside the game', async () => {
    const { statuses } = await show([target(waitingAt(1), 'a'), target(waitingAt(2, null), 'b'), target(waitingAt(null), 'c')]);

    expect(statuses.map((status) => [status?.label, status?.value, status?.meta])).toEqual([
      ['Waitlist · Table 5', 'Next in line', 'NLH 50/100'], ['Waitlist', '2nd in line', 'NLH 50/100'], ['Waitlist · Table 5', 'Requested', 'NLH 50/100'],
    ]);
    expect(statuses.map((status) => [status?.countdown, status?.action, status?.alert])).toEqual([[null, null, null], [null, null, null], [null, null, null]]);
  });

  it('shows a seat call counting down to the hold’s end, with I’m on my way, sounding with the seat’s words', async () => {
    const { statuses } = await show([target(SEAT_READY)]);

    expect(statuses).toEqual([{
      kind: 'seat_ready',
      meta: 'NLH 50/100',
      label: 'Seat ready · held for',
      value: null,
      countdown: { startsAt: new Date('2026-11-15T16:05:00Z'), endsAt: new Date('2026-11-15T16:25:00Z') },
      action: { title: "I'm on my way", url: `/?accept=${ENTRY}` },
      alert: { title: 'Your seat is ready', body: 'Table 5, seat 4. Held until 21:55.' },
    }]);
  });

  it('shows the call time counting down while seated, with Order only where the member orders to the seat', async () => {
    const { statuses } = await show([target(SEATED, 'a'), target({ ...SEATED, canOrder: false }, 'b')]);

    expect(statuses[0]).toEqual({
      kind: 'seated',
      meta: 'Table 1, seat 4',
      label: 'Call time left',
      value: null,
      countdown: { startsAt: new Date('2026-11-15T15:00:00Z'), endsAt: new Date('2026-11-15T18:00:00Z') },
      action: { title: 'Order', url: '/fnb' },
      alert: null,
    });
    expect(statuses[1]?.action).toBeNull();
  });

  it('ends what shows with no place and no seat, and while a seat’s call time is not running', async () => {
    const { statuses, noted } = await show([target(NOTHING, 'a', '{"was":"waiting"}'), target({ ...SEATED, endsAt: null }, 'b', '{"was":"seated"}')]);

    expect(statuses).toEqual([null, null]);
    expect(noted).toEqual([['a', null], ['b', null]]);
  });

  it('sends only a change: a phone already showing the status hears nothing, nor one showing nothing that should show nothing', async () => {
    const first = await show([target(SEATED)]);
    const shown = first.noted[0]?.[1] ?? null;

    const again = await show([target(SEATED, 'phone-1', shown), target(NOTHING, 'phone-2', null)]);

    expect([first.statuses.length, shown === null, again.statuses]).toEqual([1, false, []]);
  });

  it('refreshes everyone on a list that moved, and the member alone for anything else', async () => {
    const onList = await show([], moved);
    const seated = await show([], seatTaken);

    expect([onList.asked, seated.asked]).toEqual([[{ memberId: MEMBER, tableTypeId: LIST }], [{ memberId: MEMBER, tableTypeId: null }]]);
  });

  it('forgets a phone whose token is gone and still shows the others theirs', async () => {
    const liveStatus = createFakeLiveStatus();
    liveStatus.failNext({ code: 'device_gone' });
    const found = phones([target(SEATED, 'gone'), target(SEATED, 'kept')]);

    const outcome = await createLiveStatusConsumer({ liveStatus, ...found }).deliver(seatTaken);

    expect([outcome.ok, found.forgotten, found.noted.map(([deviceId]) => deviceId)]).toEqual([true, ['gone'], ['kept']]);
  });

  it('starts an iPhone’s Live Activity again on the next try once the member swiped it away', async () => {
    const liveStatus = createFakeLiveStatus();
    liveStatus.failNext({ code: 'activity_gone' });
    const found = phones([target(SEATED)]);

    const outcome = await createLiveStatusConsumer({ liveStatus, ...found }).deliver(seatTaken);

    expect([outcome, found.noted]).toEqual([{ ok: false, error: { code: 'unavailable' } }, [['phone-1', null]]]);
  });

  it('tries again when a phone could not be reached, and skips a kind of phone whose credentials are not set', async () => {
    const liveStatus = createFakeLiveStatus();
    liveStatus.failNext({ code: 'not_configured' });
    liveStatus.failNext({ code: 'rate_limited' });
    const found = phones([target(SEATED, 'iphone'), target(SEATED, 'android')]);

    const outcome = await createLiveStatusConsumer({ liveStatus, ...found }).deliver(seatTaken);

    expect([outcome, found.noted]).toEqual([{ ok: false, error: { code: 'rate_limited' } }, []]);
  });

  it('tries again for a phone that may pass, even when another phone refused for good', async () => {
    const liveStatus = createFakeLiveStatus();
    liveStatus.failNext({ code: 'rejected', reason: 'Firebase answered 400 INVALID_ARGUMENT' });
    liveStatus.failNext({ code: 'unavailable' });
    const found = phones([target(SEATED, 'refused'), target(SEATED, 'down')]);

    expect(await createLiveStatusConsumer({ liveStatus, ...found }).deliver(seatTaken)).toEqual({ ok: false, error: { code: 'unavailable' } });
  });

  it('refuses an event it cannot read', async () => {
    const consumer = createLiveStatusConsumer({ liveStatus: createFakeLiveStatus(), ...phones([]) });

    expect(await consumer.deliver(delivery('seat.taken', { table_id: LIST }))).toEqual({ ok: false, error: { code: 'rejected', reason: 'seat.taken payload is not readable' } });
    expect(await consumer.deliver(delivery('waitlist.moved', { member_id: MEMBER }))).toEqual({
      ok: false, error: { code: 'rejected', reason: 'waitlist.moved payload is not readable' },
    });
    expect(await consumer.deliver(delivery('promotion.offered', { member_id: MEMBER }))).toEqual({
      ok: false, error: { code: 'rejected', reason: 'no live status for promotion.offered' },
    });
  });
});
