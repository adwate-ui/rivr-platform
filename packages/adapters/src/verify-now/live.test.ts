import { indianMobileSchema } from '@rivr/contracts';
import { describe, expect, it } from 'vitest';
import { createFakeVerifyNow, createVerifyNow, VERIFY_NOW_URL } from './index.ts';

// The live adapter against a fake fetch: what it sends Message Central and how it reads each reply.
// The reply shapes are VerifyNow's guide's, and a refusal's is the one Message Central gave on 16 Nov.

const to = indianMobileSchema.parse('+919000000201');
const TOKEN = 'mc-token';

type Answer = { status: number; body: unknown } | 'no reply';

/** A fetch that gives a token, then answers the send or check with `answer`, recording each request. */
function fakeFetch(answer: Answer, tokenBody: unknown = { status: 200, token: TOKEN }) {
  const requests: { url: URL; init: RequestInit }[] = [];
  const fetch: typeof globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    requests.push({ url, init });
    const reply = url.pathname === '/auth/v1/authentication/token' ? { status: 200, body: tokenBody } : answer;
    if (reply === 'no reply') throw new TypeError('network down');
    return new Response(JSON.stringify(reply.body), { status: reply.status, headers: { 'content-type': 'application/json' } });
  };
  return { fetch, requests };
}

const verifyNow = (fetch: typeof globalThis.fetch) => createVerifyNow({ customerId: 'C-TEST', password: 'pässword', fetch });
const sent = (verificationId: unknown) => ({ status: 200, body: { responseCode: 200, message: 'SUCCESS', data: { verificationId, timeout: '60' } } });
const refused = (status: number, responseCode: number) => ({ status, body: { responseCode, message: 'refused', data: null } });

describe('VerifyNow sending a code', () => {
  it('asks for a token with the base64 password, then has VerifyNow text the ten digits a six-digit code', async () => {
    const { fetch, requests } = fakeFetch(sent(3_412_201));

    expect(await verifyNow(fetch).send({ to })).toEqual({ ok: true, value: { verificationId: '3412201' } });
    const [token, send] = requests;
    expect(`${token?.url.origin}${token?.url.pathname}`).toBe(`${VERIFY_NOW_URL}/auth/v1/authentication/token`);
    expect(Object.fromEntries(token?.url.searchParams ?? [])).toEqual({ customerId: 'C-TEST', key: 'cMOkc3N3b3Jk', scope: 'NEW', country: '91' });
    expect(send?.url.pathname).toBe('/verification/v3/send');
    expect(Object.fromEntries(send?.url.searchParams ?? [])).toEqual({
      countryCode: '91', customerId: 'C-TEST', flowType: 'SMS', mobileNumber: '9000000201', otpLength: '6',
    });
    expect([send?.init.method, send?.init.headers]).toEqual(['POST', { authToken: TOKEN }]);
  });

  it('says VerifyNow\'s last code still stands when it will not text the number again yet', async () => {
    expect(await verifyNow(fakeFetch(refused(400, 506)).fetch).send({ to })).toEqual({ ok: true, value: { verificationId: null } });
  });

  it('says rate-limited at VerifyNow\'s limit, refused for another refusal, and unavailable with no reply, no token or a server error, saying which', async () => {
    expect(await verifyNow(fakeFetch(refused(400, 800)).fetch).send({ to })).toEqual({ ok: false, error: { code: 'rate_limited' } });
    expect(await verifyNow(fakeFetch(refused(400, 511)).fetch).send({ to }))
      .toEqual({ ok: false, error: { code: 'rejected', reason: 'VerifyNow refused (511)' } });
    expect(await verifyNow(fakeFetch(sent(undefined)).fetch).send({ to }))
      .toEqual({ ok: false, error: { code: 'rejected', reason: 'VerifyNow refused (200)' } });
    // Which of the three goes in Auth's log when a code is not sent (decision 0683).
    expect(await verifyNow(fakeFetch('no reply').fetch).send({ to }))
      .toEqual({ ok: false, error: { code: 'unavailable', reason: 'VerifyNow did not answer' } });
    expect(await verifyNow(fakeFetch(sent('1'), { status: 401 }).fetch).send({ to }))
      .toEqual({ ok: false, error: { code: 'unavailable', reason: 'Message Central gave no token' } });
    expect(await verifyNow(fakeFetch({ status: 503, body: {} }).fetch).send({ to }))
      .toEqual({ ok: false, error: { code: 'unavailable', reason: 'VerifyNow HTTP 503' } });
  });
});

describe('VerifyNow checking a code', () => {
  it('checks the typed code by GET under the token, and accepts it when VerifyNow says the verification completed', async () => {
    const completed = { status: 200, body: { responseCode: 200, data: { verificationStatus: 'VERIFICATION_COMPLETED' } } };
    const { fetch, requests } = fakeFetch(completed);

    expect(await verifyNow(fetch).check({ verificationId: '3412201', code: '482913' })).toEqual({ ok: true, value: null });
    expect(requests[1]?.url.pathname).toBe('/verification/v3/validateOtp');
    expect(Object.fromEntries(requests[1]?.url.searchParams ?? [])).toEqual({ verificationId: '3412201', code: '482913' });
    expect([requests[1]?.init.method, requests[1]?.init.headers]).toEqual(['GET', { authToken: TOKEN }]);
  });

  it('reads each refusal: wrong, no longer valid, too many tries, or no answer', async () => {
    const check = async (answer: Answer) => verifyNow(fakeFetch(answer).fetch).check({ verificationId: '1', code: '000000' });

    expect(await check(refused(400, 702))).toEqual({ ok: false, error: 'wrong_code' });
    expect(await check(refused(400, 705))).toEqual({ ok: false, error: 'expired' });
    expect(await check(refused(400, 505))).toEqual({ ok: false, error: 'expired' });
    expect(await check(refused(400, 800))).toEqual({ ok: false, error: 'too_many' });
    expect(await check({ status: 200, body: { responseCode: 200, data: { verificationStatus: 'VERIFICATION_PENDING' } } }))
      .toEqual({ ok: false, error: 'unavailable' });
    expect(await check('no reply')).toEqual({ ok: false, error: 'unavailable' });
  });
});

describe('VerifyNow\'s token', () => {
  it('is reused for the next call, and replaced at once when Message Central refuses it', async () => {
    let refuseNext = false;
    const requests: string[] = [];
    const fetch: typeof globalThis.fetch = async (input) => {
      const { pathname } = new URL(String(input));
      requests.push(pathname);
      if (pathname === '/auth/v1/authentication/token') return Response.json({ status: 200, token: `t${String(requests.length)}` });
      if (refuseNext) {
        refuseNext = false;
        return new Response(null, { status: 401 });
      }
      return Response.json(sent('1').body);
    };
    const adapter = verifyNow(fetch);

    await adapter.send({ to });
    await adapter.send({ to });
    expect(requests).toEqual(['/auth/v1/authentication/token', '/verification/v3/send', '/verification/v3/send']);
    refuseNext = true;
    expect(await adapter.send({ to })).toEqual({ ok: true, value: { verificationId: '1' } });
    expect(requests.slice(3)).toEqual(['/verification/v3/send', '/auth/v1/authentication/token', '/verification/v3/send']);
  });
});

describe('the fake VerifyNow', () => {
  it('accepts the code it texted, once, and fails a send when told to', async () => {
    const fake = createFakeVerifyNow();
    const first = await fake.send({ to });
    const verificationId = first.ok ? first.value.verificationId ?? '' : '';
    const code = fake.codeOf(verificationId) ?? '';

    expect(await fake.check({ verificationId, code: '000000' })).toEqual({ ok: false, error: 'wrong_code' });
    expect(await fake.check({ verificationId, code })).toEqual({ ok: true, value: null });
    expect(await fake.check({ verificationId, code })).toEqual({ ok: false, error: 'expired' });
    fake.failNext({ code: 'unavailable' });
    expect(await fake.send({ to })).toEqual({ ok: false, error: { code: 'unavailable' } });
    expect(fake.calls).toEqual([{ to }, { to }]);
  });
});
