import { describe, expect, it } from 'vitest';
import { createApnsLiveActivity } from './apns.ts';
import { createLiveStatus } from './byPlatform.ts';
import { createFakeLiveStatus } from './fake.ts';
import { createFcmOngoing } from './fcm.ts';
import { answer, fakeVendor, testKey } from './testing.ts';
import type { PhoneAlert } from './types.ts';

const NOW = new Date('2026-11-15T16:00:05Z');
const IPHONE: PhoneAlert = { id: 'event-1', platform: 'ios', token: 'a1'.repeat(32), title: 'Call time', body: '15 minutes left.', url: '/', tag: 'call-time-1' };
const ANDROID: PhoneAlert = { ...IPHONE, platform: 'android', token: 'dXk3:APA91bHPRgkF3JUikC4ENAHEeMrd41Zxv' };

async function apple(answers: Response[] = []) {
  const key = await testKey('apple');
  const vendor = fakeVendor(answers);
  const adapter = createApnsLiveActivity({
    teamId: 'TEAM123456', keyId: 'KEY1234567', privateKey: key.pem, bundleId: 'club.rivr.player', environment: 'production', fetch: vendor.fetch, now: () => NOW,
  });
  return { adapter, received: vendor.received };
}

async function firebase(answers: Response[]) {
  const key = await testKey('google');
  const vendor = fakeVendor(answers);
  const adapter = createFcmOngoing({ projectId: 'rivr-test', clientEmail: 'a@rivr-test.iam.gserviceaccount.com', privateKey: key.pem, fetch: vendor.fetch, now: () => NOW });
  return { adapter, received: vendor.received };
}
const granted = () => answer(200, { access_token: 'google-access-1', expires_in: 3600, token_type: 'Bearer' });

describe('an alert on an iPhone', () => {
  it('goes to the phone’s device token as an ordinary alert, with the app as its topic', async () => {
    const { adapter, received } = await apple([answer(200, {}, { 'apns-id': 'apns-1' })]);
    expect(await adapter.alert(IPHONE)).toEqual({ ok: true, value: { id: 'apns-1' } });
    const [sent] = received;
    expect(sent?.url).toBe(`https://api.push.apple.com/3/device/${IPHONE.token}`);
    expect(sent?.headers.get('apns-push-type')).toBe('alert');
    expect(sent?.headers.get('apns-topic')).toBe('club.rivr.player');
    expect(sent?.headers.get('apns-collapse-id')).toBe('call-time-1');
    expect(sent?.headers.get('apns-expiration')).toBe(String(Math.floor(NOW.getTime() / 1000) + 3600));
    expect(JSON.parse(sent?.body ?? '')).toEqual({ aps: { alert: { title: 'Call time', body: '15 minutes left.' }, sound: 'default' }, url: '/' });
  });

  it('holds its collapse id to Apple’s 64 bytes', async () => {
    const { adapter, received } = await apple([answer(200)]);
    await adapter.alert({ ...IPHONE, tag: 'x'.repeat(80) });
    expect(received[0]?.headers.get('apns-collapse-id')).toHaveLength(64);
  });

  it('says the phone is gone when Apple no longer knows it', async () => {
    const { adapter } = await apple([answer(410, { reason: 'Unregistered' })]);
    expect(await adapter.alert(IPHONE)).toEqual({ ok: false, error: { code: 'device_gone' } });
  });

  it('is refused for an Android phone', async () => {
    const { adapter } = await apple();
    expect((await adapter.alert(ANDROID)).ok).toBe(false);
  });
});

describe('an alert on an Android phone', () => {
  it('is a data message the app’s own service posts, so a signed-out phone shows nothing', async () => {
    const { adapter, received } = await firebase([granted(), answer(200, { name: 'projects/rivr-test/messages/1' })]);
    expect(await adapter.alert(ANDROID)).toEqual({ ok: true, value: { id: 'projects/rivr-test/messages/1' } });
    expect(JSON.parse(received[1]?.body ?? '')).toEqual({
      message: { token: ANDROID.token, data: { kind: 'rivr_alert', id: 'event-1', title: 'Call time', body: '15 minutes left.', url: '/', tag: 'call-time-1' }, android: { priority: 'HIGH', ttl: '3600s' } },
    });
  });

  it('says the phone is gone when Firebase no longer knows it', async () => {
    const { adapter } = await firebase([granted(), answer(404, { error: { status: 'NOT_FOUND' } })]);
    expect(await adapter.alert(ANDROID)).toEqual({ ok: false, error: { code: 'device_gone' } });
  });

  it('is refused for an iPhone', async () => {
    const { adapter } = await firebase([]);
    expect((await adapter.alert(IPHONE)).ok).toBe(false);
  });
});

describe('createLiveStatus', () => {
  it('sends each kind of phone’s alert through its own service, and is not configured for one without credentials', async () => {
    const ios = createFakeLiveStatus();
    const live = createLiveStatus({ ios });
    await live.alert(IPHONE);
    expect(ios.alerts).toEqual([IPHONE]);
    expect(await live.alert(ANDROID)).toEqual({ ok: false, error: { code: 'not_configured' } });
  });
});
