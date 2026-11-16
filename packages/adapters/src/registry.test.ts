import { indianMobileSchema, memberIdSchema } from '@rivr/contracts';
import { describe, expect, it } from 'vitest';
import { createFakeLiveStatus } from './live-status/index.ts';
import { createAdapters, createFakeAdapters } from './registry.ts';
import { createFakeSmsOtp } from './sms-otp/index.ts';

const phone = indianMobileSchema.parse('+919000000001');
const memberId = memberIdSchema.parse('3f2b8c4e-9d1a-4b6f-8e2c-7a5d9f0b1c3e');

describe('createAdapters for the practice venue', () => {
  it('always uses fakes, even when live adapters are configured, so nothing reaches a vendor', async () => {
    const liveSms = createFakeSmsOtp();

    const adapters = createAdapters({ isPracticeVenue: true, live: { smsOtp: liveSms } });
    await adapters.smsOtp.sendOtp({ to: phone, code: '482913' });

    expect(liveSms.calls).toEqual([]);
    expect((await adapters.kyc.startDigiLocker({ memberId, returnUrl: 'https://app.rivr.test/kyc', deliveryUrl: 'https://db.rivr.test/functions/v1/kyc-digilocker' })).ok).toBe(true);
  });
});

describe('createAdapters and the lock-screen live status', () => {
  it('never shows a practice venue status on a phone, and uses the live one at a real venue', async () => {
    const live = createFakeLiveStatus();
    const status = { device: { platform: 'android' as const, token: 'dXk3:APA91bHPRgkF3JUikC4ENAH', activityToken: null }, status: null };

    await createAdapters({ isPracticeVenue: true, live: { liveStatus: live } }).liveStatus.show(status);
    expect(live.calls).toEqual([]);
    expect(createAdapters({ isPracticeVenue: false, live: { liveStatus: live } }).liveStatus).toBe(live);
  });
});

describe('createAdapters for a real venue', () => {
  it('uses the live adapter wherever one is configured', async () => {
    const liveSms = createFakeSmsOtp();

    const adapters = createAdapters({ isPracticeVenue: false, live: { smsOtp: liveSms } });
    await adapters.smsOtp.sendOtp({ to: phone, code: '482913' });

    expect(adapters.smsOtp).toBe(liveSms);
    expect(liveSms.calls).toHaveLength(1);
  });

  it('falls back to the fake for an adapter without credentials', async () => {
    const adapters = createAdapters({ isPracticeVenue: false, live: {} });

    expect(await adapters.whatsapp.sendTemplate({ category: 'utility', to: phone, template: 'x', params: [] })).toMatchObject({
      ok: true,
    });
    expect(await adapters.cachePurge.purgeUrls({ urls: ['https://rivr.test/'] })).toMatchObject({ ok: true });
  });

  it('verifies no one through a vendor without credentials: identity is never faked, and the desk checks in person', async () => {
    const adapters = createAdapters({ isPracticeVenue: false, live: {} });
    const notConfigured = { ok: false, error: { code: 'not_configured' } };

    // No liveness, so the selfie is kept; no vendor check goes through, so the check waits for the desk (decision 0678).
    expect(adapters.kyc.checkLiveness).toBeUndefined();
    expect(await adapters.kyc.startDigiLocker({ memberId, returnUrl: 'https://app.rivr.test/kyc', deliveryUrl: 'https://db.rivr.test/functions/v1/kyc-digilocker' }))
      .toEqual(notConfigured);
    expect(await adapters.kyc.matchFace({ selfieUrl: 'x', referenceUrl: 'y' })).toEqual(notConfigured);
  });
});

describe('createFakeAdapters', () => {
  it('gives every adapter a fake with its call log', () => {
    const fakes = createFakeAdapters();

    expect(Object.keys(fakes)).toHaveLength(10);
    expect(fakes.cctv.calls).toEqual([]);
  });
});
