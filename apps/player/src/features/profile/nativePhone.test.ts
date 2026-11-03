import { describe, expect, it } from 'vitest';
import { deviceOf } from './hooks/useNativePhone.ts';
import { forgetPhone, LIVE_STATUS_PLUGIN, type LiveStatusPlugin } from './nativePhone.ts';

const TOKEN = 'dXk3:APA91bHPRgkF3JUikC4ENAH';

/** A phone that kept `kept`; `steps` records what it and the database were asked, in order. */
function phone(kept: { token: string | null; deviceKey: string | null }, steps: string[]): LiveStatusPlugin {
  return {
    checkPermissions: async () => ({ notifications: 'granted' }),
    register: async () => ({ platform: 'android', token: 'unused' }),
    current: async () => kept,
    keepDeviceKey: async () => undefined,
    unregister: async () => {
      steps.push('phone ends what shows');
      return { token: kept.token };
    },
  };
}

describe('forgetPhone', () => {
  it('has no phone to forget in a browser', async () => {
    expect(LIVE_STATUS_PLUGIN).toBeNull();
    expect(await forgetPhone(async () => 'removed')).toBeNull();
  });

  it('forgets the phone while the member is still signed in, then ends what its lock screen shows', async () => {
    const steps: string[] = [];
    const removed = await forgetPhone(async (token) => { steps.push(`database forgets ${token}`); return 'removed'; },
      phone({ token: TOKEN, deviceKey: 'f0'.repeat(32) }, steps));

    expect([removed, steps]).toEqual(['removed', [`database forgets ${TOKEN}`, 'phone ends what shows']]);
  });

  it('asks the database nothing for a phone that had it off, and still ends what shows', async () => {
    const steps: string[] = [];
    expect(await forgetPhone(async () => 'removed', phone({ token: TOKEN, deviceKey: null }, steps))).toBeNull();
    expect(steps).toEqual(['phone ends what shows']);
  });
});

describe('deviceOf', () => {
  it('takes a registered phone only in the shape the database takes', () => {
    expect(deviceOf({ platform: 'ios', token: 'a1'.repeat(32) })).toEqual({ platform: 'ios', token: 'a1'.repeat(32) });
    expect(deviceOf({ platform: 'web', token: 'a1'.repeat(32) })).toBeNull();
  });
});
