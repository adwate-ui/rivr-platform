import { indianMobileSchema } from '@rivr/contracts';
import { describe, expect, it } from 'vitest';
import { createWhatsAppCloudApi, GRAPH_API_VERSION } from './index.ts';

// The live adapter against a fake fetch: what it sends Meta and how it reads each reply.

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

const accepted = { messaging_product: 'whatsapp', messages: [{ id: 'wamid.ABC123' }] };

function sentBody(requests: { init: RequestInit }[]): unknown {
  return JSON.parse(String(requests[0]?.init.body));
}

describe('WhatsApp Cloud API', () => {
  it('sends an authentication template with the code in the body and the copy-code button', async () => {
    const { fetch, requests } = fakeFetch(200, accepted);
    const whatsapp = createWhatsAppCloudApi({ phoneNumberId: '1098765', accessToken: 'test-token', fetch });

    const sent = await whatsapp.sendTemplate({ category: 'authentication', to, template: 'sign_in_code', language: 'en', params: ['482913'] });

    expect(sent).toEqual({ ok: true, value: { messageId: 'wamid.ABC123' } });
    expect(requests[0]?.url).toBe(`https://graph.facebook.com/${GRAPH_API_VERSION}/1098765/messages`);
    expect(requests[0]?.init.headers).toEqual({ authorization: 'Bearer test-token', 'content-type': 'application/json' });
    expect(sentBody(requests)).toEqual({
      messaging_product: 'whatsapp',
      to: '919000000201',
      type: 'template',
      template: {
        name: 'sign_in_code',
        language: { code: 'en' },
        components: [
          { type: 'body', parameters: [{ type: 'text', text: '482913' }] },
          { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: '482913' }] },
        ],
      },
    });
  });

  it('sends a utility template with its body parameters and no button', async () => {
    const { fetch, requests } = fakeFetch(200, accepted);
    const whatsapp = createWhatsAppCloudApi({ phoneNumberId: '1098765', accessToken: 'test-token', fetch });

    await whatsapp.sendTemplate({ category: 'utility', to, template: 'seat_ready', language: 'hi', params: ['Table 3', '6'] });

    expect(sentBody(requests)).toMatchObject({
      template: {
        name: 'seat_ready',
        language: { code: 'hi' },
        components: [{ type: 'body', parameters: [{ type: 'text', text: 'Table 3' }, { type: 'text', text: '6' }] }],
      },
    });
  });

  it.each([
    ['an HTTP 429', 429, { error: { code: 130429 } }, { code: 'rate_limited' }],
    ['a per-user pair rate limit', 400, { error: { code: 131056 } }, { code: 'rate_limited' }],
    ['a server error', 503, { error: { code: 2 } }, { code: 'unavailable' }],
    ['a refused template', 400, { error: { code: 132001 } }, { code: 'rejected', reason: 'WhatsApp error 132001' }],
    ['a reply it cannot read', 200, { messages: [] }, { code: 'unavailable' }],
  ])('maps %s to a failure the caller handles', async (_case, status, body, failure) => {
    const { fetch } = fakeFetch(status, body);
    const whatsapp = createWhatsAppCloudApi({ phoneNumberId: '1098765', accessToken: 'test-token', fetch });

    expect(await whatsapp.sendTemplate({ category: 'utility', to, template: 'seat_ready', language: 'en', params: [] })).toEqual({
      ok: false,
      error: failure,
    });
  });

  it('treats a network failure as unavailable', async () => {
    const whatsapp = createWhatsAppCloudApi({
      phoneNumberId: '1098765',
      accessToken: 'test-token',
      fetch: () => Promise.reject(new TypeError('fetch failed')),
    });

    expect(await whatsapp.sendTemplate({ category: 'utility', to, template: 'seat_ready', language: 'en', params: [] })).toEqual({
      ok: false,
      error: { code: 'unavailable' },
    });
  });
});
