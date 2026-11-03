import { describe, expect, it } from 'vitest';
import { liveStatusDeviceSchema, liveStatusTokenReportSchema, waitlistMovedSchema } from './liveStatus.ts';

describe('liveStatusDeviceSchema', () => {
  it('takes an iPhone push-to-start token in hex and an Android registration token', () => {
    expect(liveStatusDeviceSchema.safeParse({ platform: 'ios', token: 'a1'.repeat(32) }).success).toBe(true);
    expect(liveStatusDeviceSchema.safeParse({ platform: 'android', token: 'dXk3:APA91bHPRgkF3JUikC4ENAHEeMrd41Zxv' }).success).toBe(true);
  });

  it('refuses a token not shaped for its platform, and any other platform', () => {
    expect(liveStatusDeviceSchema.safeParse({ platform: 'ios', token: 'dXk3:APA91bHPRgkF3JUikC4ENAHEeMrd41Zxv' }).success).toBe(false);
    expect(liveStatusDeviceSchema.safeParse({ platform: 'android', token: 'short' }).success).toBe(false);
    expect(liveStatusDeviceSchema.safeParse({ platform: 'android', token: 'has spaces in it, twenty and more' }).success).toBe(false);
    expect(liveStatusDeviceSchema.safeParse({ platform: 'windows', token: 'a1'.repeat(32) }).success).toBe(false);
  });
});

describe('liveStatusTokenReportSchema', () => {
  const deviceKey = 'f0'.repeat(32);

  it('takes the phone key with a push-to-start token or a Live Activity token', () => {
    expect(liveStatusTokenReportSchema.safeParse({ device_key: deviceKey, activity_push_token: 'b2'.repeat(32) }).success).toBe(true);
    expect(liveStatusTokenReportSchema.safeParse({ device_key: deviceKey, push_token: 'a1'.repeat(32) }).success).toBe(true);
  });

  it('refuses a report with no token, a short key or a token not in hex', () => {
    expect(liveStatusTokenReportSchema.safeParse({ device_key: deviceKey }).success).toBe(false);
    expect(liveStatusTokenReportSchema.safeParse({ device_key: 'f0', activity_push_token: 'b2'.repeat(32) }).success).toBe(false);
    expect(liveStatusTokenReportSchema.safeParse({ device_key: deviceKey, activity_push_token: 'not-hex'.repeat(10) }).success).toBe(false);
  });
});

describe('waitlistMovedSchema', () => {
  it('names the place, its member and the list', () => {
    const moved = {
      entry_id: '3f2b8c4e-9d1a-4b6f-8e2c-7a5d9f0b1c3e',
      member_id: '6a1f9c2e-3b4d-4e5f-8a6b-7c8d9e0f1a2b',
      table_type_id: '0b1c3e3f-2b8c-4e9d-8a4b-6f8e2c7a5d9f',
    };
    expect(waitlistMovedSchema.parse(moved)).toEqual(moved);
    expect(waitlistMovedSchema.safeParse({ ...moved, table_type_id: undefined }).success).toBe(false);
  });
});
