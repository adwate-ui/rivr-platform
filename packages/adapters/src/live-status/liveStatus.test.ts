import { describe, expect, it } from 'vitest';
import { createLiveStatus } from './byPlatform.ts';
import { createFakeLiveStatus } from './fake.ts';
import type { LiveStatus, LiveStatusDevice } from './types.ts';

const waiting: LiveStatus = {
  kind: 'waiting', meta: 'NLH 50/100', label: 'Waitlist', value: 'Next in line', countdown: null, action: null, alert: null,
};
const iphone: LiveStatusDevice = { platform: 'ios', token: 'a1'.repeat(32), activityToken: null };
const android: LiveStatusDevice = { platform: 'android', token: 'dXk3:APA91bHPRgkF3JUikC4ENAHEeMrd41Zxv', activityToken: null };

describe('createFakeLiveStatus', () => {
  it('records each status and fails on demand', async () => {
    const fake = createFakeLiveStatus();
    fake.failNext({ code: 'device_gone' });

    expect(await fake.show({ device: android, status: waiting })).toEqual({ ok: false, error: { code: 'device_gone' } });
    expect(await fake.show({ device: android, status: null })).toEqual({ ok: true, value: { id: 'fake-live-status-2' } });
    expect(fake.calls.map((call) => call.status?.kind ?? 'ended')).toEqual(['waiting', 'ended']);
  });
});

describe('createLiveStatus', () => {
  it('sends an iPhone’s status through Apple’s side and an Android phone’s through Firebase’s', async () => {
    const ios = createFakeLiveStatus();
    const firebase = createFakeLiveStatus();
    const live = createLiveStatus({ ios, android: firebase });

    await live.show({ device: iphone, status: waiting });
    await live.show({ device: android, status: waiting });

    expect([ios.calls.map((call) => call.device), firebase.calls.map((call) => call.device)]).toEqual([[iphone], [android]]);
  });

  it('is not configured for a kind of phone without its credentials', async () => {
    const live = createLiveStatus({ android: createFakeLiveStatus() });

    expect(await live.show({ device: iphone, status: waiting })).toEqual({ ok: false, error: { code: 'not_configured' } });
  });
});
