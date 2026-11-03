import { describe, expect, it } from 'vitest';
import { deviceOf } from './hooks/useNativePhone.ts';
import { LIVE_STATUS_PLUGIN, unregisterOnSignOut, type LiveStatusPlugin } from './nativePhone.ts';

/** A plugin whose unregister gives `token`. */
function plugin(token: string | null): LiveStatusPlugin {
  return {
    checkPermissions: async () => ({ notifications: 'granted' }),
    register: async () => ({ platform: 'android', token: 'unused' }),
    current: async () => ({ token, deviceKey: null }),
    keepDeviceKey: async () => undefined,
    unregister: async () => ({ token }),
  };
}

describe('the native app’s LiveStatus plugin', () => {
  it('is not there in a browser, where signing out has no phone to forget', async () => {
    expect(LIVE_STATUS_PLUGIN).toBeNull();
    expect(await unregisterOnSignOut()).toBeNull();
  });

  it('forgets the phone on signing out with the token it had', async () => {
    expect(await unregisterOnSignOut(plugin('dXk3:APA91bHPRgkF3JUikC4ENAH'))).toBe('dXk3:APA91bHPRgkF3JUikC4ENAH');
  });

  it('takes a registered phone only in the shape the database takes', () => {
    expect(deviceOf({ platform: 'ios', token: 'a1'.repeat(32) })).toEqual({ platform: 'ios', token: 'a1'.repeat(32) });
    expect(deviceOf({ platform: 'web', token: 'a1'.repeat(32) })).toBeNull();
  });
});
