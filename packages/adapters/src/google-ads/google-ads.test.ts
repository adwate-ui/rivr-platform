import { idempotencyKeySchema, indianMobileSchema } from '@rivr/contracts';
import { describe, expect, it } from 'vitest';
import { sha256Hex } from '../shared/hash.ts';
import { createFakeGoogleAds, toClickConversion, type OfflineConversion } from './index.ts';

const conversion: OfflineConversion = {
  orderId: idempotencyKeySchema.parse('6a1f9c2e-3b4d-4e5f-8a6b-7c8d9e0f1a2b'),
  conversionAction: 'customers/123/conversionActions/456',
  conversionTime: new Date('2026-11-16T18:40:00Z'),
  gclid: 'Cj0KCQ-test',
  phone: indianMobileSchema.parse('+919000000001'),
};

describe('Google Ads offline conversion', () => {
  it('carries the order id, the time with its offset, the click id and the hashed E.164 phone', async () => {
    expect(await toClickConversion(conversion)).toEqual({
      orderId: conversion.orderId,
      conversionAction: conversion.conversionAction,
      conversionDateTime: '2026-11-16 18:40:00+00:00',
      gclid: 'Cj0KCQ-test',
      userIdentifiers: [{ hashedPhoneNumber: await sha256Hex('+919000000001') }],
    });
  });

  it('leaves the click id out when the visit did not come from an ad click', async () => {
    expect(await toClickConversion({ ...conversion, gclid: null })).not.toHaveProperty('gclid');
  });
});

describe('fake Google Ads', () => {
  it('uploads and keeps only the hashed conversion', async () => {
    const ads = createFakeGoogleAds();

    expect(await ads.upload(conversion)).toEqual({ ok: true, value: { accepted: 1 } });
    expect(ads.calls).toEqual([await toClickConversion(conversion)]);
  });

  it('fails the next upload when a test scripts it', async () => {
    const ads = createFakeGoogleAds();
    ads.failNext({ code: 'rejected', reason: 'conversion action not found' });

    expect(await ads.upload(conversion)).toMatchObject({ ok: false, error: { code: 'rejected' } });
  });
});
