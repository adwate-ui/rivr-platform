import {
  idempotencyKeySchema,
  indianMobileSchema,
  memberIdSchema,
  paiseSchema,
  SOCIAL_CHANNELS,
  upiVpaSchema,
} from '@rivr/contracts';
import { describe, expect, it } from 'vitest';
import { createAdapters, createFakeAdapters } from './registry.ts';
import { createFakeSmsOtp } from './sms-otp/index.ts';
import { createFakeSocialPublishing } from './social-publishing/index.ts';
import { createFakeUpiPayouts } from './upi-payouts/index.ts';

const phone = indianMobileSchema.parse('+919000000001');
const memberId = memberIdSchema.parse('3f2b8c4e-9d1a-4b6f-8e2c-7a5d9f0b1c3e');
const payout = {
  idempotencyKey: idempotencyKeySchema.parse('6a1f9c2e-3b4d-4e5f-8a6b-7c8d9e0f1a2b'),
  to: upiVpaSchema.parse('arjun.mehta@hdfcbank'),
  payeeName: 'Arjun Mehta',
  amount: paiseSchema.parse(10_000_000n),
  note: 'RIVR withdrawal',
};
const post = { caption: 'Tonight', media: [] };

describe('createAdapters for the practice venue', () => {
  it('always uses fakes, even when live adapters are configured, so nothing reaches a vendor', async () => {
    const liveSms = createFakeSmsOtp();
    const livePayouts = createFakeUpiPayouts();
    const liveInstagram = createFakeSocialPublishing().instagram;

    const adapters = createAdapters({
      isPracticeVenue: true,
      live: { smsOtp: liveSms, upiPayouts: livePayouts, socialPublishing: { instagram: liveInstagram } },
    });
    await adapters.smsOtp.sendOtp({ to: phone, code: '482913' });
    await adapters.upiPayouts.pay(payout);
    await adapters.socialPublishing.instagram.publish(post);

    expect([liveSms.calls, livePayouts.calls, liveInstagram.calls]).toEqual([[], [], []]);
    expect((await adapters.kyc.startDigiLocker({ memberId, returnUrl: 'https://app.rivr.test/kyc' })).ok).toBe(true);
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

    expect(await adapters.whatsapp.sendTemplate({ category: 'utility', to: phone, template: 'x', language: 'en', params: [] })).toMatchObject({
      ok: true,
    });
    expect(await adapters.cachePurge.purgeUrls({ urls: ['https://rivr.test/'] })).toMatchObject({ ok: true });
  });

  it('fails closed for payouts and KYC without credentials: money and identity are never faked', async () => {
    const adapters = createAdapters({ isPracticeVenue: false, live: {} });

    expect(await adapters.upiPayouts.pay(payout)).toEqual({ ok: false, error: { code: 'not_configured' } });
    expect(await adapters.kyc.checkLiveness({ selfieUrl: 'x' })).toEqual({ ok: false, error: { code: 'not_configured' } });
  });

  it('falls back to download-and-post for each social channel without credentials', async () => {
    const liveInstagram = createFakeSocialPublishing().instagram;

    const adapters = createAdapters({ isPracticeVenue: false, live: { socialPublishing: { instagram: liveInstagram } } });

    expect(await adapters.socialPublishing.instagram.publish(post)).toMatchObject({ value: { kind: 'published' } });
    for (const channel of SOCIAL_CHANNELS.filter((name) => name !== 'instagram')) {
      expect(await adapters.socialPublishing[channel].publish(post)).toEqual({ ok: true, value: { kind: 'download_and_post', channel } });
    }
  });
});

describe('createFakeAdapters', () => {
  it('gives every adapter a fake with its call log', () => {
    const fakes = createFakeAdapters();

    expect(Object.keys(fakes)).toHaveLength(16);
    expect(fakes.receiptPrinter.calls).toEqual([]);
  });
});
