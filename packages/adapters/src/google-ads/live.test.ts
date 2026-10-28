import { idempotencyKeySchema, indianMobileSchema } from '@rivr/contracts';
import { describe, expect, it } from 'vitest';
import { sha256Hex } from '../shared/hash.ts';
import { createGoogleAdsConversions, GOOGLE_ADS_API_VERSION, type OfflineConversion } from './index.ts';

// The live adapter against a fake fetch: the token exchange, the upload, and how each reply is read.

const conversion: OfflineConversion = {
  orderId: idempotencyKeySchema.parse('6a1f9c2e-3b4d-4e5f-8a6b-7c8d9e0f1a2b'),
  conversionAction: 'customers/1234567890/conversionActions/111',
  conversionTime: new Date('2026-11-16T18:40:00Z'),
  gclid: null,
  phone: indianMobileSchema.parse('+919000000001'),
};

const OPTIONS = { developerToken: 'dev', clientId: 'client', clientSecret: 'secret', refreshToken: 'refresh', customerId: '1234567890', loginCustomerId: '999' };

/** Answers the token exchange, then each upload with the next of `uploads`. */
function fakeGoogle(...uploads: { status: number; body: unknown }[]) {
  const requests: { url: string; init: RequestInit }[] = [];
  const fetch: typeof globalThis.fetch = async (input, init = {}) => {
    requests.push({ url: String(input), init });
    if (String(input).startsWith('https://oauth2.googleapis.com/')) return Response.json({ access_token: 'access', expires_in: 3599 });
    const next = uploads.shift() ?? { status: 200, body: { results: [{}] } };
    return new Response(JSON.stringify(next.body), { status: next.status });
  };
  return { fetch, requests };
}

describe('Google Ads offline conversions', () => {
  it('exchanges the refresh token once, then uploads the conversion with the phone hashed', async () => {
    const { fetch, requests } = fakeGoogle();
    const google = createGoogleAdsConversions({ ...OPTIONS, fetch, now: () => 0 });

    expect(await google.upload(conversion)).toEqual({ ok: true, value: { accepted: 1 } });
    expect(await google.upload(conversion)).toEqual({ ok: true, value: { accepted: 1 } });
    expect(requests.map((request) => request.url)).toEqual([
      'https://oauth2.googleapis.com/token',
      `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/1234567890:uploadClickConversions`,
      `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/1234567890:uploadClickConversions`,
    ]);
    expect(String(requests[0]?.init.body)).toBe('grant_type=refresh_token&client_id=client&client_secret=secret&refresh_token=refresh');
    expect(requests[1]?.init.headers).toEqual({
      authorization: 'Bearer access', 'developer-token': 'dev', 'content-type': 'application/json', 'login-customer-id': '999',
    });
    expect(JSON.parse(String(requests[1]?.init.body))).toEqual({
      conversions: [{
        orderId: conversion.orderId, conversionAction: conversion.conversionAction, conversionDateTime: '2026-11-16 18:40:00+00:00',
        userIdentifiers: [{ hashedPhoneNumber: await sha256Hex('+919000000001') }],
      }],
      partialFailure: true,
    });
  });

  it('gives up on a refused conversion, retries a rate limit or an outage', async () => {
    const upload = async (status: number, body: unknown) =>
      createGoogleAdsConversions({ ...OPTIONS, fetch: fakeGoogle({ status, body }).fetch }).upload(conversion);
    expect(await upload(200, { partialFailureError: { code: 3 } })).toEqual({ ok: false, error: { code: 'rejected', reason: 'Google Ads refused the conversion' } });
    expect(await upload(429, {})).toEqual({ ok: false, error: { code: 'rate_limited' } });
    expect(await upload(503, {})).toEqual({ ok: false, error: { code: 'unavailable' } });
    expect(await upload(401, {})).toEqual({ ok: false, error: { code: 'rejected', reason: 'Google Ads error 401' } });
  });

  it('counts a network failure or a token reply without a token as unavailable', async () => {
    const down: typeof globalThis.fetch = async () => { throw new TypeError('network down'); };
    expect(await createGoogleAdsConversions({ ...OPTIONS, fetch: down }).upload(conversion)).toEqual({ ok: false, error: { code: 'unavailable' } });
    const noToken: typeof globalThis.fetch = async () => Response.json({});
    expect(await createGoogleAdsConversions({ ...OPTIONS, fetch: noToken }).upload(conversion)).toEqual({ ok: false, error: { code: 'unavailable' } });
  });
});
