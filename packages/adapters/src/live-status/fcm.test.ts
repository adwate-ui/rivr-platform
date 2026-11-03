import { describe, expect, it } from 'vitest';
import { createFcmOngoing } from './fcm.ts';
import { answer, fakeVendor, readJwt, testKey } from './testing.ts';
import type { LiveStatus, LiveStatusDevice } from './types.ts';

const NOW = new Date('2026-11-15T17:00:00Z');
const STARTED = new Date('2026-11-15T15:00:00Z');
const ENDS = new Date('2026-11-15T18:00:00Z');

const seated: LiveStatus = {
  kind: 'seated',
  meta: 'Table 1 · Seat 4',
  label: 'Call time left',
  value: null,
  countdown: { startsAt: STARTED, endsAt: ENDS },
  action: { title: 'Order', url: '/fnb' },
  alert: null,
};
const TOKEN = 'dXk3:APA91bHPRgkF3JUikC4ENAHEeMrd41Zxv';
const phone: LiveStatusDevice = { platform: 'android', token: TOKEN, activityToken: null };
const granted = (expiresIn = 3600) => answer(200, { access_token: 'google-access-1', expires_in: expiresIn, token_type: 'Bearer' });

let googleKey: Awaited<ReturnType<typeof testKey>> | undefined;
async function firebase(answers: Response[], clock = () => NOW) {
  googleKey ??= await testKey('google');
  const vendor = fakeVendor(answers);
  const adapter = createFcmOngoing({
    projectId: 'rivr-test', clientEmail: 'live-status@rivr-test.iam.gserviceaccount.com', privateKey: googleKey.pem, fetch: vendor.fetch, now: clock,
  });
  return { adapter, received: vendor.received, publicKey: googleKey.publicKey };
}

describe('createFcmOngoing', () => {
  it('asks Google for an access token with the service account, then sends the phone a data message', async () => {
    const { adapter, received, publicKey } = await firebase([granted(), answer(200, { name: 'projects/rivr-test/messages/1' })]);

    expect(await adapter.show({ device: phone, status: seated })).toEqual({ ok: true, value: { id: 'projects/rivr-test/messages/1' } });

    const form = new URLSearchParams(received[0]?.body);
    expect([received[0]?.url, form.get('grant_type')]).toEqual(['https://oauth2.googleapis.com/token', 'urn:ietf:params:oauth:grant-type:jwt-bearer']);
    const iat = Math.floor(NOW.getTime() / 1000);
    expect(await readJwt(form.get('assertion') ?? '', publicKey)).toEqual({
      header: { alg: 'RS256', typ: 'JWT' },
      claims: {
        iss: 'live-status@rivr-test.iam.gserviceaccount.com', scope: 'https://www.googleapis.com/auth/firebase.messaging',
        aud: 'https://oauth2.googleapis.com/token', iat, exp: iat + 3600,
      },
      isSigned: true,
    });
    expect(received[1]?.url).toBe('https://fcm.googleapis.com/v1/projects/rivr-test/messages:send');
    expect(received[1]?.headers.get('authorization')).toBe('Bearer google-access-1');
    expect(JSON.parse(received[1]?.body ?? '')).toEqual({
      message: {
        token: TOKEN,
        android: { priority: 'HIGH', ttl: '3600s', collapse_key: 'live_status' },
        data: {
          kind: 'rivr_live_status', state: 'seated', meta: 'Table 1 · Seat 4', label: 'Call time left', value: '',
          startsAt: String(STARTED.getTime()), endsAt: String(ENDS.getTime()), actionTitle: 'Order', actionUrl: '/fnb', alert: '',
        },
      },
    });
  });

  it('keeps the access token until a minute before it runs out', async () => {
    let clock = NOW;
    const { adapter, received } = await firebase([granted(3600), answer(200), answer(200), granted(3600), answer(200)], () => clock);

    await adapter.show({ device: phone, status: seated });
    clock = new Date(NOW.getTime() + 58 * 60 * 1000);
    await adapter.show({ device: phone, status: seated });
    clock = new Date(NOW.getTime() + 59 * 60 * 1000 + 1);
    await adapter.show({ device: phone, status: seated });

    expect(received.map((request) => new URL(request.url).hostname)).toEqual([
      'oauth2.googleapis.com', 'fcm.googleapis.com', 'fcm.googleapis.com', 'oauth2.googleapis.com', 'fcm.googleapis.com',
    ]);
  });

  it('ends what the phone shows with a data message that says so, and sounds a seat call', async () => {
    const { adapter, received } = await firebase([granted()]);

    await adapter.show({ device: phone, status: null });
    await adapter.show({ device: phone, status: { ...seated, kind: 'seat_ready', alert: { title: 'Your seat is ready', body: 'Table 1, seat 4.' } } });

    expect(JSON.parse(received[1]?.body ?? '').message.data).toEqual({ kind: 'rivr_live_status', state: 'ended' });
    expect(JSON.parse(received[2]?.body ?? '').message.data).toMatchObject({ state: 'seat_ready', alert: '1' });
  });

  it('forgets a phone Firebase no longer knows, or one of another project', async () => {
    const { adapter } = await firebase([
      granted(),
      answer(404, { error: { status: 'NOT_FOUND', details: [{ '@type': 'type.googleapis.com/google.firebase.fcm.v1.FcmError', errorCode: 'UNREGISTERED' }] } }),
      answer(403, { error: { status: 'PERMISSION_DENIED', details: [{ errorCode: 'SENDER_ID_MISMATCH' }] } }),
    ]);

    expect(await adapter.show({ device: phone, status: seated })).toEqual({ ok: false, error: { code: 'device_gone' } });
    expect(await adapter.show({ device: phone, status: seated })).toEqual({ ok: false, error: { code: 'device_gone' } });
  });

  it('retries what can pass, asks for a new access token after a 401, and gives up on a bad message', async () => {
    const { adapter, received } = await firebase([
      granted(), answer(429, { error: { status: 'RESOURCE_EXHAUSTED' } }), answer(503, { error: { status: 'UNAVAILABLE' } }),
      answer(401, { error: { status: 'UNAUTHENTICATED' } }), granted(), answer(400, { error: { status: 'INVALID_ARGUMENT' } }),
    ]);
    const show = () => adapter.show({ device: phone, status: seated });

    expect([await show(), await show(), await show()].map((sent) => !sent.ok && sent.error.code)).toEqual(['rate_limited', 'unavailable', 'unavailable']);
    expect(await show()).toEqual({ ok: false, error: { code: 'rejected', reason: 'Firebase answered 400 INVALID_ARGUMENT' } });
    expect(received.filter((request) => request.url.startsWith('https://oauth2')).length).toBe(2);
  });

  it('gives up when Google refuses the service account, and waits when it cannot be reached', async () => {
    const refused = await firebase([answer(400, { error: 'invalid_grant' })]);
    expect(await refused.adapter.show({ device: phone, status: seated })).toEqual({
      ok: false, error: { code: 'rejected', reason: 'Google refused the service account' },
    });
    const down = await firebase([answer(502, 'Bad Gateway')]);
    expect(await down.adapter.show({ device: phone, status: seated })).toEqual({ ok: false, error: { code: 'unavailable' } });
  });

  it('is unavailable when Firebase cannot be reached, and sends only to an Android phone', async () => {
    googleKey ??= await testKey('google');
    const adapter = createFcmOngoing({
      projectId: 'rivr-test', clientEmail: 'x@rivr-test.iam.gserviceaccount.com', privateKey: googleKey.pem,
      fetch: async () => { throw new TypeError('network'); },
    });

    expect(await adapter.show({ device: phone, status: seated })).toEqual({ ok: false, error: { code: 'unavailable' } });
    expect(await adapter.show({ device: { platform: 'ios', token: 'a1'.repeat(32), activityToken: null }, status: seated })).toEqual({
      ok: false, error: { code: 'rejected', reason: 'Firebase sends to an Android phone only' },
    });
  });
});
