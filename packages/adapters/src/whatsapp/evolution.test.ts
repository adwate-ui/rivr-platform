import { indianMobileSchema } from '@rivr/contracts';
import { describe, expect, it } from 'vitest';
import { createWhatsAppEvolution } from './index.ts';

// The Evolution bridge adapter against a fake fetch: what it sends the bridge and how it reads each reply.

const to = indianMobileSchema.parse('+919000000201');
const bridge = { baseUrl: 'https://wa.example.test/', apiKey: 'test-key', instance: 'rivr staging' };

/** A fetch that records each request and answers with `status` and `body`. */
function fakeFetch(status: number, body: unknown) {
  const requests: { url: string; init: RequestInit }[] = [];
  const fetch: typeof globalThis.fetch = async (input, init = {}) => {
    requests.push({ url: String(input), init });
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  };
  return { fetch, requests };
}

const accepted = { key: { remoteJid: '919000000201@s.whatsapp.net', fromMe: true, id: '3EB0C431C26A1916E07A' }, status: 'PENDING' };

describe('WhatsApp through the Evolution bridge', () => {
  it('sends a sign-in code as the authentication template\'s text', async () => {
    const { fetch, requests } = fakeFetch(201, accepted);
    const whatsapp = createWhatsAppEvolution({ ...bridge, fetch });

    const sent = await whatsapp.sendTemplate({ category: 'authentication', to, template: 'sign_in_code', params: ['482913'] });

    expect(sent).toEqual({ ok: true, value: { messageId: '3EB0C431C26A1916E07A' } });
    expect(requests[0]?.url).toBe('https://wa.example.test/message/sendText/rivr%20staging');
    expect(requests[0]?.init.headers).toEqual({ apikey: 'test-key', 'content-type': 'application/json' });
    expect(JSON.parse(String(requests[0]?.init.body))).toEqual({
      number: '919000000201',
      text: '482913 is your RIVR sign-in code. Never share it.',
    });
  });

  it('fills every numbered parameter of a utility template', async () => {
    const { fetch, requests } = fakeFetch(201, accepted);
    const whatsapp = createWhatsAppEvolution({ ...bridge, fetch });

    await whatsapp.sendTemplate({ category: 'utility', to, template: 'seat_ready', params: ['Table 3', '6', '21:40'] });

    expect(JSON.parse(String(requests[0]?.init.body))).toMatchObject({ text: 'Your seat is ready. Table 3, seat 6. Hold expires 21:40.' });
  });

  it('sends a refusal with its reason and the desk, and one for age with neither (8 Nov audit, F-049)', async () => {
    const { fetch, requests } = fakeFetch(201, accepted);
    const whatsapp = createWhatsAppEvolution({ ...bridge, fetch });

    await whatsapp.sendTemplate({ category: 'utility', to, template: 'kyc_refused', params: ['your details did not match'] });
    await whatsapp.sendTemplate({ category: 'utility', to, template: 'kyc_under_age', params: [] });

    expect(requests.map((request) => JSON.parse(String(request.init.body)).text)).toEqual([
      'RIVR could not verify you: your details did not match. Bring your Aadhaar and PAN to the front desk.',
      "RIVR could not verify you. You are under the club's minimum age.",
    ]);
  });

  it('refuses a missing parameter, a link button and a marketing template without an opt-in, sending nothing', async () => {
    const { fetch, requests } = fakeFetch(201, accepted);
    const whatsapp = createWhatsAppEvolution({ ...bridge, fetch });

    expect(await whatsapp.sendTemplate({ category: 'utility', to, template: 'seat_ready', params: ['Table 3'] })).toEqual({
      ok: false, error: { code: 'rejected', reason: 'template seat_ready is unknown or missing a parameter' },
    });
    expect(await whatsapp.sendTemplate({ category: 'utility', to, template: 'receipt_ready', params: ['₹10,000'], urlButton: 'r/ab12' })).toEqual({
      ok: false, error: { code: 'rejected', reason: 'the bridge sends no link buttons' },
    });
    expect(await whatsapp.sendTemplate({ category: 'utility', to, template: 'promotion', params: ['Bonus Tuesday'] })).toEqual({
      ok: false, error: { code: 'rejected', reason: 'a marketing template needs the member\'s opt-in' },
    });
    expect(requests).toEqual([]);
  });

  it.each([
    ['a number not on WhatsApp', 400, { status: 400, response: { message: [{ exists: false, number: '919000000201' }] } }, { code: 'rejected', reason: 'the number is not on WhatsApp' }],
    ['a logged-out phone', 400, { status: 400, response: { message: ['Connection Closed'] } }, { code: 'unavailable' }],
    ['an instance the bridge does not have', 404, { status: 404 }, { code: 'unavailable' }],
    ['a refused key', 401, { status: 401 }, { code: 'unavailable' }],
    ['an HTTP 429', 429, {}, { code: 'rate_limited' }],
    ['a server error', 500, {}, { code: 'unavailable' }],
    ['any other refusal', 400, { status: 400, response: { message: ['bad request'] } }, { code: 'rejected', reason: 'WhatsApp bridge error 400' }],
  ])('maps %s to a failure the caller handles, with no number in it', async (_case, status, body, failure) => {
    const { fetch } = fakeFetch(status, body);
    const whatsapp = createWhatsAppEvolution({ ...bridge, fetch });

    expect(await whatsapp.sendTemplate({ category: 'utility', to, template: 'owner_alert', params: ['A table is closing'] })).toEqual({ ok: false, error: failure });
  });

  it('counts any accepted reply as sent, even one whose message id it cannot read', async () => {
    const { fetch } = fakeFetch(200, { status: 'PENDING' });
    const whatsapp = createWhatsAppEvolution({ ...bridge, fetch });

    expect(await whatsapp.sendTemplate({ category: 'utility', to, template: 'owner_alert', params: ['x'] })).toEqual({ ok: true, value: { messageId: 'unknown' } });
  });

  it('gives up on a reply that takes longer than the timeout, and on a network failure, as unavailable', async () => {
    const neverAnswers: typeof globalThis.fetch = (_input, init) =>
      new Promise((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(init.signal?.reason)));
    const slow = createWhatsAppEvolution({ ...bridge, fetch: neverAnswers, timeoutMs: 20 });
    const down = createWhatsAppEvolution({ ...bridge, fetch: () => Promise.reject(new TypeError('fetch failed')) });

    expect(await slow.sendTemplate({ category: 'utility', to, template: 'owner_alert', params: ['x'] })).toEqual({ ok: false, error: { code: 'unavailable' } });
    expect(await down.sendTemplate({ category: 'utility', to, template: 'owner_alert', params: ['x'] })).toEqual({ ok: false, error: { code: 'unavailable' } });
  });
});
