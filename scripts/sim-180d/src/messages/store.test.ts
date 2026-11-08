import { describe, expect, it } from 'vitest';
import { createOutboxStore, createRpc, toDelivery, type Rpc } from './store.ts';

const ROW = {
  delivery_id: 'd1',
  event_id: 'e1',
  venue_id: 'v1',
  event_type: 'waitlist.called',
  payload: { member_id: 'm1' },
  attempts: 1,
  occurred_at: '2026-11-15T13:00:00Z',
};

function recordingRpc(answer: unknown): { rpc: Rpc; calls: [string, object][] } {
  const calls: [string, object][] = [];
  return {
    calls,
    rpc: async (name, args) => {
      calls.push([name, args]);
      return answer;
    },
  };
}

describe('createRpc', () => {
  it('tries a closed connection again, but not an HTTP failure', async () => {
    let calls = 0;
    const flaky: typeof fetch = async () => {
      calls += 1;
      if (calls === 1) throw new TypeError('fetch failed');
      return new Response('[]', { status: 200 });
    };
    expect(await createRpc('http://x', 'key', flaky, 0)('claim_outbox_deliveries', {})).toEqual([]);
    expect(calls).toBe(2);
    let refused = 0;
    const failing: typeof fetch = async () => {
      refused += 1;
      return new Response('no', { status: 500 });
    };
    await expect(createRpc('http://x', 'key', failing, 0)('claim_outbox_deliveries', {})).rejects.toThrow('failed (500)');
    expect(refused).toBe(1);
  });

  it('gives up after three closed connections', async () => {
    let calls = 0;
    const down: typeof fetch = async () => {
      calls += 1;
      throw new TypeError('fetch failed');
    };
    await expect(createRpc('http://x', 'key', down, 0)('claim_outbox_deliveries', {})).rejects.toThrow('fetch failed');
    expect(calls).toBe(3);
  });

  it('posts to the REST endpoint with the service role', async () => {
    const seen: { url: string; init: RequestInit | undefined }[] = [];
    const fetcher: typeof fetch = async (url, init) => {
      seen.push({ url: String(url), init });
      return new Response(JSON.stringify([ROW]), { status: 200 });
    };
    const rpc = createRpc('http://127.0.0.1:55721', 'key', fetcher);
    expect(await rpc('claim_outbox_deliveries', { p_limit: 1 })).toEqual([ROW]);
    expect(seen[0]?.url).toBe('http://127.0.0.1:55721/rest/v1/rpc/claim_outbox_deliveries');
    expect(seen[0]?.init?.body).toBe('{"p_limit":1}');
  });

  it('returns null for 204 and throws on a failure', async () => {
    const empty = createRpc('http://x', 'key', async () => new Response(null, { status: 204 }));
    expect(await empty('finish_outbox_delivery', {})).toBeNull();
    const failing = createRpc('http://x', 'key', async () => new Response('no', { status: 500 }));
    await expect(failing('claim_outbox_deliveries', {})).rejects.toThrow('claim_outbox_deliveries failed (500)');
  });
});

describe('toDelivery', () => {
  it('reads a claimed row', () => {
    expect(toDelivery(ROW)).toEqual({
      deliveryId: 'd1',
      eventId: 'e1',
      venueId: 'v1',
      eventType: 'waitlist.called',
      payload: { member_id: 'm1' },
      attempts: 1,
      occurredAt: new Date('2026-11-15T13:00:00Z'),
    });
  });
});

describe('createOutboxStore', () => {
  it('claims through claim_outbox_deliveries', async () => {
    const { rpc, calls } = recordingRpc([ROW]);
    const claimed = await createOutboxStore(rpc).claim({ consumer: 'whatsapp', eventTypes: ['waitlist.called'], isMessaging: true, limit: 20 });
    expect(claimed.map((delivery) => delivery.deliveryId)).toEqual(['d1']);
    expect(calls[0]).toEqual([
      'claim_outbox_deliveries',
      { p_consumer: 'whatsapp', p_event_types: ['waitlist.called'], p_is_messaging: true, p_limit: 20 },
    ]);
  });

  it('claims nothing when the answer is not a list', async () => {
    const { rpc } = recordingRpc(null);
    expect(await createOutboxStore(rpc).claim({ consumer: 'push', eventTypes: [], isMessaging: true, limit: 20 })).toEqual([]);
  });

  it('finishes with a retry interval, or none for a rejection', async () => {
    const { rpc, calls } = recordingRpc(null);
    const store = createOutboxStore(rpc);
    await store.finish({ deliveryId: 'd1', attempts: 2, isDelivered: false, error: 'unavailable', retryAfterSeconds: 120 });
    await store.finish({ deliveryId: 'd2', attempts: 1, isDelivered: false, error: 'rejected: x', retryAfterSeconds: null });
    expect(calls.map(([, args]) => Reflect.get(args, 'p_retry_after'))).toEqual(['120 seconds', null]);
  });
});
