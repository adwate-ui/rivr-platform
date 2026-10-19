import { fromPaise } from '@rivr/domain';
import { createOfflineQueue } from '@rivr/offline';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { IDBFactory } from 'fake-indexeddb';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRivrClient } from './client.ts';
import { nextQueueState, useHandQueue, type QueuedHand } from './handQueue.ts';
import { RivrDataProvider } from './provider.tsx';

/** What the fake API answers a call with: a value, or a database error by its code. */
type Answer = { value: unknown } | { code: string };

/**
 * The queue on a fake API. Each RPC answers from `answers[rpc]` in turn, or throws while `link.isDown`
 * (the tablet offline). Every call that reached the API is in `calls`, in order.
 */
function renderQueue(answers: Record<string, Answer[]>, link = { isDown: false }, indexedDB = new IDBFactory()) {
  const calls: { rpc: string; body: Record<string, unknown> }[] = [];
  vi.stubGlobal('indexedDB', indexedDB);
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    if (link.isDown) throw new TypeError('Failed to fetch');
    const rpc = (input instanceof Request ? input.url : String(input)).split('/rpc/')[1] ?? '';
    calls.push({ rpc, body: JSON.parse(String(init?.body ?? '{}')) });
    const queued = answers[rpc] ?? [];
    // The last answer repeats, so a retry on the queue's own timer hears the same.
    const answer = (queued.length > 1 ? queued.shift() : queued[0]) ?? { value: null };
    return 'code' in answer ? Response.json({ code: answer.code, message: answer.code }, { status: 400 }) : Response.json(answer.value);
  });
  const client = createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client}>{children}</RivrDataProvider>;
  const { result } = renderHook(() => useHandQueue(), { wrapper });
  return { result, calls };
}

const HAND: QueuedHand = { pot: fromPaise(4800000n), variant: 'holdem', playedAt: '2026-10-19T15:35:00.000Z', claim: null };
const CLAIMED: QueuedHand = { ...HAND, pot: fromPaise(2000000n), claim: { seat: 4, category: 'straight_flush', rank: null } };

function backOnline() {
  act(() => { window.dispatchEvent(new Event('online')); });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('the tablet\'s queue of hands', () => {
  it('sends hands oldest first, each with its key, and a claim straight after its hand', async () => {
    const { result, calls } = renderQueue({ log_hand: [{ value: 'h1' }, { value: 'h2' }], claim_high_hand: [{ value: 'c1' }] });
    await act(async () => {
      await result.current.log(CLAIMED, 'r-1');
      await result.current.log(HAND, 'r-2');
    });
    await waitFor(() => expect(calls).toHaveLength(3));
    expect(calls).toEqual([
      { rpc: 'log_hand', body: { p_pot: 2000000, p_variant: 'holdem', p_played_at: '2026-10-19T15:35:00.000Z', p_idempotency_key: 'r-1' } },
      { rpc: 'claim_high_hand', body: { p_hand_id: 'h1', p_seat: 4, p_category: 'straight_flush', p_rank: '' } },
      { rpc: 'log_hand', body: { p_pot: 4800000, p_variant: 'holdem', p_played_at: '2026-10-19T15:35:00.000Z', p_idempotency_key: 'r-2' } },
    ]);
    await waitFor(() => expect(result.current).toMatchObject({ pending: 0, refused: 0 }));
  });

  it('holds hands while offline and sends them in order, once each, when the connection is back', async () => {
    const link = { isDown: true };
    const { result, calls } = renderQueue({ log_hand: [{ value: 'h1' }, { value: 'h2' }] }, link);
    await act(async () => {
      await result.current.log(HAND, 'r-1');
      await result.current.log({ ...HAND, pot: fromPaise(50000n) }, 'r-2');
    });
    await waitFor(() => expect(result.current.queued.map((hand) => hand.pot)).toEqual([4800000n, 50000n]));
    link.isDown = false;
    backOnline();
    await waitFor(() => expect(result.current.pending).toBe(0));
    expect(calls.map((call) => call.body['p_idempotency_key'])).toEqual(['r-1', 'r-2']);
  });

  it('says how many hands held offline reached the floor, and nothing for a hand logged online', () => {
    const empty = { queued: [], refused: 0, held: 0, sent: null };
    const offline = nextQueueState(nextQueueState(empty, [HAND], 0, false), [HAND, HAND], 0, false);
    expect(offline).toMatchObject({ held: 2, sent: null });
    const sending = nextQueueState(offline, [HAND], 0, true);
    expect(sending).toMatchObject({ held: 2, sent: null });
    const landed = nextQueueState(sending, [], 0, true);
    expect(landed).toMatchObject({ held: 0, sent: 2 });
    expect(nextQueueState(landed, [HAND], 0, true)).toMatchObject({ sent: null });
    expect(nextQueueState(nextQueueState(empty, [HAND], 0, true), [], 0, true)).toMatchObject({ held: 0, sent: null });
  });

  it('sends the hands it kept through a reload as soon as the tablet opens again', async () => {
    const indexedDB = new IDBFactory();
    // Before the power cut: a hand kept on the tablet, not yet sent.
    const before = createOfflineQueue<QueuedHand>({ name: 'tablet-hands', indexedDB, send: async () => 'retry' });
    await before.enqueue(HAND, 'r-1');
    await before.flush();
    before.close();
    const { result, calls } = renderQueue({ log_hand: [{ value: 'h1' }] }, { isDown: false }, indexedDB);
    await waitFor(() => expect(calls.map((call) => call.body['p_idempotency_key'])).toEqual(['r-1']));
    await waitFor(() => expect(result.current.pending).toBe(0));
  });

  it('keeps a hand while the venue is frozen, and the hands behind it wait their turn', async () => {
    const { result, calls } = renderQueue({ log_hand: [{ code: 'RVFRZ' }] });
    await act(async () => {
      await result.current.log(HAND, 'r-1');
      await result.current.log(HAND, 'r-2');
    });
    await waitFor(() => expect(calls.length).toBeGreaterThanOrEqual(2));
    expect(new Set(calls.map((call) => call.body['p_idempotency_key']))).toEqual(new Set(['r-1']));
    await waitFor(() => expect(result.current).toMatchObject({ pending: 2, refused: 0 }));
  });

  it('sets aside a hand refused for good, and the next one goes', async () => {
    const { result, calls } = renderQueue({ log_hand: [{ code: '22023' }, { value: 'h2' }] });
    await act(async () => {
      await result.current.log(HAND, 'r-1');
      await result.current.log(HAND, 'r-2');
    });
    await waitFor(() => expect(result.current).toMatchObject({ pending: 0, refused: 1 }));
    expect(calls.map((call) => call.body['p_idempotency_key'])).toEqual(['r-1', 'r-2']);
  });
});
