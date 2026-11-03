import { describe, expect, it } from 'vitest';
import { createApnsLiveActivity } from './apns.ts';
import { answer, fakeVendor, readJwt, testKey } from './testing.ts';
import type { LiveStatus, LiveStatusDevice } from './types.ts';

const NOW = new Date('2026-11-15T16:00:05Z');
const seconds = (at: Date) => Math.floor(at.getTime() / 1000);
const CALLED = new Date('2026-11-15T16:00:00Z');
const HELD_UNTIL = new Date('2026-11-15T16:20:00Z');

const seatReady: LiveStatus = {
  kind: 'seat_ready',
  meta: 'NLH 50/100',
  label: 'Seat ready · held for',
  value: null,
  countdown: { startsAt: CALLED, endsAt: HELD_UNTIL },
  action: { title: "I'm on my way", url: '/?accept=entry-1' },
  alert: { title: 'Your seat is ready', body: 'Table 1, seat 4. Held until 21:50.' },
};
const waiting: LiveStatus = {
  kind: 'waiting', meta: 'NLH 50/100', label: 'Waitlist · Table 1', value: '2nd in line', countdown: null, action: null, alert: null,
};

const START_TOKEN = 'a1'.repeat(32);
const ACTIVITY_TOKEN = 'b2'.repeat(32);
const iphone = (activityToken: string | null = null): LiveStatusDevice => ({ platform: 'ios', token: START_TOKEN, activityToken });

async function apple(answers: Response[] = [], environment: 'sandbox' | 'production' = 'production', clock = () => NOW) {
  const key = await testKey('apple');
  const vendor = fakeVendor(answers);
  const adapter = createApnsLiveActivity({
    teamId: 'TEAM123456', keyId: 'KEY1234567', privateKey: key.pem, bundleId: 'club.rivr.player', environment, fetch: vendor.fetch, now: clock,
  });
  return { adapter, received: vendor.received, publicKey: key.publicKey };
}

const apsOf = (body: string): Record<string, unknown> => JSON.parse(body).aps;

describe('createApnsLiveActivity', () => {
  it('starts a Live Activity with the push-to-start token when none runs, with its attributes, its alert and when it goes stale', async () => {
    const { adapter, received } = await apple([answer(200, {}, { 'apns-id': 'apple-1' })]);

    expect(await adapter.show({ device: iphone(), status: seatReady })).toEqual({ ok: true, value: { id: 'apple-1' } });
    expect(received[0]?.url).toBe(`https://api.push.apple.com/3/device/${START_TOKEN}`);
    expect(Object.fromEntries(['apns-push-type', 'apns-topic', 'apns-priority'].map((name) => [name, received[0]?.headers.get(name)]))).toEqual({
      'apns-push-type': 'liveactivity', 'apns-topic': 'club.rivr.player.push-type.liveactivity', 'apns-priority': '10',
    });
    expect(apsOf(received[0]?.body ?? '')).toEqual({
      timestamp: seconds(NOW),
      event: 'start',
      'content-state': {
        kind: 'seat_ready', meta: 'NLH 50/100', label: 'Seat ready · held for', value: null, startsAt: seconds(CALLED), endsAt: seconds(HELD_UNTIL),
        actionTitle: "I'm on my way", actionUrl: '/?accept=entry-1',
      },
      'stale-date': seconds(HELD_UNTIL),
      alert: { title: 'Your seat is ready', body: 'Table 1, seat 4. Held until 21:50.', sound: 'default' },
      'attributes-type': 'RivrLiveAttributes',
      attributes: {},
    });
  });

  it('starts a quiet status with a silent alert of its own words, as Apple needs one to start', async () => {
    const { adapter, received } = await apple();

    await adapter.show({ device: iphone(), status: waiting });

    expect(apsOf(received[0]?.body ?? '')).toMatchObject({ event: 'start', alert: { title: 'Waitlist · Table 1', body: '2nd in line' } });
    expect(apsOf(received[0]?.body ?? '').alert).not.toHaveProperty('sound');
  });

  it('updates the running Live Activity through its own token: a place quietly, a seat call at once with its alert', async () => {
    const { adapter, received } = await apple();

    await adapter.show({ device: iphone(ACTIVITY_TOKEN), status: waiting });
    await adapter.show({ device: iphone(ACTIVITY_TOKEN), status: seatReady });

    expect(received.map((request) => request.url)).toEqual([
      `https://api.push.apple.com/3/device/${ACTIVITY_TOKEN}`, `https://api.push.apple.com/3/device/${ACTIVITY_TOKEN}`,
    ]);
    expect(received.map((request) => request.headers.get('apns-priority'))).toEqual(['5', '10']);
    expect(apsOf(received[0]?.body ?? '')).not.toHaveProperty('alert');
    expect(apsOf(received[1]?.body ?? '')).toMatchObject({ event: 'update', alert: { title: 'Your seat is ready' } });
  });

  it('ends the running Live Activity at once, and sends nothing when none runs', async () => {
    const { adapter, received } = await apple();

    expect(await adapter.show({ device: iphone(), status: null })).toEqual({ ok: true, value: { id: '' } });
    await adapter.show({ device: iphone(ACTIVITY_TOKEN), status: null });

    expect(received).toHaveLength(1);
    expect(apsOf(received[0]?.body ?? '')).toMatchObject({ event: 'end', 'dismissal-date': seconds(NOW), 'content-state': { kind: 'ended' } });
  });

  it('signs with the club key: ES256, its key id, the team as issuer, and keeps the token for most of its hour', async () => {
    let clock = NOW;
    const { adapter, received, publicKey } = await apple([], 'production', () => clock);

    await adapter.show({ device: iphone(), status: waiting });
    await adapter.show({ device: iphone(), status: waiting });
    clock = new Date(NOW.getTime() + 51 * 60 * 1000);
    await adapter.show({ device: iphone(), status: waiting });

    const [first, second, third] = received.map((request) => request.headers.get('authorization')?.replace('bearer ', '') ?? '');
    expect(await readJwt(first ?? '', publicKey)).toEqual({
      header: { alg: 'ES256', typ: 'JWT', kid: 'KEY1234567' }, claims: { iss: 'TEAM123456', iat: seconds(NOW) }, isSigned: true,
    });
    expect(second).toBe(first);
    expect(third).not.toBe(first);
  });

  it('sends to Apple’s sandbox for a development build', async () => {
    const { adapter, received } = await apple([], 'sandbox');

    await adapter.show({ device: iphone(), status: waiting });

    expect(received[0]?.url).toBe(`https://api.sandbox.push.apple.com/3/device/${START_TOKEN}`);
  });

  it('says which token Apple no longer knows: the phone’s push-to-start, or the Live Activity’s', async () => {
    const { adapter } = await apple([answer(410, { reason: 'Unregistered' }), answer(410, { reason: 'Unregistered' }), answer(400, { reason: 'BadDeviceToken' })]);

    expect(await adapter.show({ device: iphone(), status: waiting })).toEqual({ ok: false, error: { code: 'device_gone' } });
    expect(await adapter.show({ device: iphone(ACTIVITY_TOKEN), status: waiting })).toEqual({ ok: false, error: { code: 'activity_gone' } });
    expect(await adapter.show({ device: iphone(), status: waiting })).toEqual({ ok: false, error: { code: 'device_gone' } });
  });

  it('retries what can pass and gives up on what cannot', async () => {
    const { adapter } = await apple([
      answer(429, { reason: 'TooManyRequests' }), answer(503, { reason: 'ServiceUnavailable' }), answer(403, { reason: 'ExpiredProviderToken' }),
      answer(403, { reason: 'InvalidProviderToken' }), answer(400, { reason: 'BadExpirationDate' }),
    ]);
    const show = () => adapter.show({ device: iphone(), status: waiting });

    expect([await show(), await show(), await show()].map((sent) => !sent.ok && sent.error.code)).toEqual(['rate_limited', 'unavailable', 'unavailable']);
    expect(await show()).toEqual({ ok: false, error: { code: 'rejected', reason: 'Apple answered 403 InvalidProviderToken' } });
    expect(await show()).toEqual({ ok: false, error: { code: 'rejected', reason: 'Apple answered 400 BadExpirationDate' } });
  });

  it('is unavailable when Apple cannot be reached, and sends only to an iPhone', async () => {
    const key = await testKey('apple');
    const adapter = createApnsLiveActivity({
      teamId: 'TEAM123456', keyId: 'KEY1234567', privateKey: key.pem, bundleId: 'club.rivr.player', environment: 'production',
      fetch: async () => { throw new TypeError('network'); },
    });

    expect(await adapter.show({ device: iphone(), status: waiting })).toEqual({ ok: false, error: { code: 'unavailable' } });
    expect(await adapter.show({ device: { platform: 'android', token: 'x'.repeat(30), activityToken: null }, status: waiting })).toEqual({
      ok: false, error: { code: 'rejected', reason: 'Apple sends to an iPhone only' },
    });
  });
});
