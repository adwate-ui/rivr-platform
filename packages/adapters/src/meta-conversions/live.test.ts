import { idempotencyKeySchema, indianMobileSchema, memberIdSchema } from '@rivr/contracts';
import { describe, expect, it } from 'vitest';
import { sha256Hex } from '../shared/hash.ts';
import { createMetaConversionsApi, type MetaConversionEvent } from './index.ts';

// The live adapter against a fake fetch: what it sends Meta and how it reads each reply.

const visit: MetaConversionEvent = {
  eventId: idempotencyKeySchema.parse('6a1f9c2e-3b4d-4e5f-8a6b-7c8d9e0f1a2b'),
  eventName: 'FirstVisit',
  eventTime: new Date('2026-11-16T18:40:00Z'),
  memberId: memberIdSchema.parse('3f2b8c4e-9d1a-4b6f-8e2c-7a5d9f0b1c3e'),
  phone: indianMobileSchema.parse('+919000000001'),
};

function fakeFetch(status: number, body: unknown) {
  const requests: { url: string; init: RequestInit }[] = [];
  const fetch: typeof globalThis.fetch = async (input, init = {}) => {
    requests.push({ url: String(input), init });
    return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });
  };
  return { fetch, requests };
}

describe('Meta Conversions API', () => {
  it('posts the hashed event to the dataset with the token in a header', async () => {
    const { fetch, requests } = fakeFetch(200, { events_received: 1, fbtrace_id: 'A1' });
    const meta = createMetaConversionsApi({ pixelId: '123456', accessToken: 'test-token', fetch });

    expect(await meta.send(visit)).toEqual({ ok: true, value: { eventsReceived: 1 } });
    expect(requests[0]?.url).toBe('https://graph.facebook.com/v23.0/123456/events');
    expect(requests[0]?.init.headers).toEqual({ authorization: 'Bearer test-token', 'content-type': 'application/json' });
    const sent: unknown = JSON.parse(String(requests[0]?.init.body));
    expect(sent).toEqual({ data: [expect.objectContaining({ event_name: 'FirstVisit', action_source: 'physical_store', event_id: visit.eventId })] });
    expect(JSON.stringify(sent)).toContain(await sha256Hex('919000000001'));
    expect(JSON.stringify(sent)).not.toContain('9000000001"');
  });

  it('retries a rate limit or an outage, and gives up on a refusal', async () => {
    const send = async (status: number, body: unknown) => createMetaConversionsApi({ pixelId: '1', accessToken: 't', fetch: fakeFetch(status, body).fetch }).send(visit);
    expect(await send(400, { error: { code: 17 } })).toEqual({ ok: false, error: { code: 'rate_limited' } });
    expect(await send(429, {})).toEqual({ ok: false, error: { code: 'rate_limited' } });
    expect(await send(502, '<html>')).toEqual({ ok: false, error: { code: 'unavailable' } });
    expect(await send(400, { error: { code: 100 } })).toEqual({ ok: false, error: { code: 'rejected', reason: 'Meta error 100' } });
  });

  it('counts a network failure as unavailable', async () => {
    const fetch: typeof globalThis.fetch = async () => { throw new TypeError('network down'); };
    expect(await createMetaConversionsApi({ pixelId: '1', accessToken: 't', fetch }).send(visit)).toEqual({ ok: false, error: { code: 'unavailable' } });
  });
});
