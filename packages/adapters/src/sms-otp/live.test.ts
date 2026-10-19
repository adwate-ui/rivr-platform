import { indianMobileSchema } from '@rivr/contracts';
import { describe, expect, it } from 'vitest';
import { createMsg91SmsOtp, MSG91_OTP_URL } from './index.ts';

// The live adapter against a fake fetch: what it sends MSG91 and how it reads each reply.

const to = indianMobileSchema.parse('+919000000201');

/** A fetch that records each request and answers with `status` and `body`. */
function fakeFetch(status: number, body: unknown) {
  const requests: { url: string; init: RequestInit }[] = [];
  const fetch: typeof globalThis.fetch = async (input, init = {}) => {
    requests.push({ url: String(input), init });
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  };
  return { fetch, requests };
}

const msg91 = (fetch: typeof globalThis.fetch) => createMsg91SmsOtp({ authKey: 'test-key', templateId: 'tpl-sign-in', fetch });

describe('MSG91 SMS', () => {
  it('sends the code on the DLT template to the number, with the key as a header', async () => {
    const { fetch, requests } = fakeFetch(200, { type: 'success', request_id: '3463686a7a43373533383032' });

    expect(await msg91(fetch).sendOtp({ to, code: '482913' })).toEqual({ ok: true, value: { messageId: '3463686a7a43373533383032' } });
    const url = new URL(requests[0]?.url ?? '');
    expect(`${url.origin}${url.pathname}`).toBe(MSG91_OTP_URL);
    expect(Object.fromEntries(url.searchParams)).toEqual({ template_id: 'tpl-sign-in', mobile: '919000000201', otp: '482913' });
    expect(requests[0]?.init.method).toBe('POST');
    expect(requests[0]?.init.headers).toEqual({ authkey: 'test-key', 'content-type': 'application/json' });
    expect(url.search).not.toContain('test-key');
  });

  it('reads a refusal inside an HTTP 200, without the number or the code in the reason', async () => {
    const { fetch } = fakeFetch(200, { type: 'error', message: 'Invalid template for mobile 919000000201' });
    const sent = await msg91(fetch).sendOtp({ to, code: '482913' });
    expect(sent).toEqual({ ok: false, error: { code: 'rejected', reason: 'MSG91 refused (HTTP 200)' } });
  });

  it('says rate-limited when MSG91 limits the number or the account', async () => {
    expect(await msg91(fakeFetch(200, { type: 'error', message: 'OTP request limit reached' }).fetch).sendOtp({ to, code: '1' }))
      .toEqual({ ok: false, error: { code: 'rate_limited' } });
    expect(await msg91(fakeFetch(429, {}).fetch).sendOtp({ to, code: '1' })).toEqual({ ok: false, error: { code: 'rate_limited' } });
  });

  it('says unavailable on a server error, a page that is not JSON, or no reply in time', async () => {
    expect(await msg91(fakeFetch(502, {}).fetch).sendOtp({ to, code: '1' })).toEqual({ ok: false, error: { code: 'unavailable' } });
    const html: typeof globalThis.fetch = async () => new Response('<html>Bad gateway</html>', { status: 503 });
    expect(await msg91(html).sendOtp({ to, code: '1' })).toEqual({ ok: false, error: { code: 'unavailable' } });
    const silent: typeof globalThis.fetch = async (_input, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
    });
    const slow = createMsg91SmsOtp({ authKey: 'k', templateId: 't', fetch: silent, timeoutMs: 20 });
    expect(await slow.sendOtp({ to, code: '1' })).toEqual({ ok: false, error: { code: 'unavailable' } });
  });
});
