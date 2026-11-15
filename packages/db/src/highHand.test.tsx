import { createClient } from '@supabase/supabase-js';
import { QueryClient } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { toHighHandTonight, useHighHandLive, useHighHandTonight, useLogHighHand } from './highHand.ts';
import { RivrDataProvider } from './provider.tsx';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

const SIGNED_IN = '00000000-0000-4000-8000-000000000101';
const CLUB = '00000000-0000-4000-8000-000000000001';

/** A row of high_hand_tonight: Devansh's four Jacks at Table 2, the newest of two hands paid tonight. */
const row = (more: Record<string, unknown> = {}) => ({
  hit_id: 'h2', logged_at: '2026-11-15T21:13:00+00:00', member_id: 'm1', member_name: 'Devansh Malik', table_name: 'Table 2', seat: 3,
  hand: 'four_of_a_kind', rank: 'jack', chips: 5_000, logged_by: 'Farid Khan', paid_count: 2, paid_chips: 15_000, ...more,
});

function renderTonight(reply: { status?: number; body: unknown }, promotionId: string | null = null) {
  const asked: unknown[] = [];
  const fetch: typeof globalThis.fetch = async (_input, init) => {
    asked.push(JSON.parse(String(init?.body)));
    return Response.json(reply.body, { status: reply.status ?? 200 });
  };
  const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
    global: { fetch },
    auth: { storage: sessionStorageFor(SIGNED_IN), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
  });
  // No retries, so a refusal is an error at once.
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client} queryClient={queryClient}>{children}</RivrDataProvider>;
  return { result: renderHook(() => useHighHandTonight(CLUB, promotionId), { wrapper }).result, asked };
}

afterEach(cleanup);

describe('tonight\'s high hands (redesign RD-23)', () => {
  it('reads the night\'s count and Bonus, and the latest fifty hits, newest first', async () => {
    const { result, asked } = renderTonight({ body: [row(), row({ hit_id: 'h1', hand: 'straight_flush', rank: 'nine', seat: 1, chips: 10_000 })] });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(asked).toEqual([{ p_venue_id: CLUB, p_limit: 50 }]);
    expect(result.current.data).toMatchObject({ handsPaid: 2, chipsPaid: 15_000 });
    expect(result.current.data?.hits).toEqual([
      { id: 'h2', at: '2026-11-15T21:13:00+00:00', memberId: 'm1', memberName: 'Devansh Malik', tableName: 'Table 2', seat: 3, hand: 'four_of_a_kind',
        rank: 'jack', chips: 5_000, loggedBy: 'Farid Khan' },
      expect.objectContaining({ id: 'h1', hand: 'straight_flush', rank: 'nine', seat: 1, chips: 10_000 }),
    ]);
  });

  it('asks for one promotion\'s hits alone on its record', async () => {
    const { result, asked } = renderTonight({ body: [row()] }, 'p9');
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(asked).toEqual([{ p_venue_id: CLUB, p_limit: 50, p_promotion_id: 'p9' }]);
  });

  it('counts every hit of the night, though it lists the latest only', () => {
    expect(toHighHandTonight([row({ paid_count: 61, paid_chips: 3_05_000 })])).toMatchObject({ handsPaid: 61, chipsPaid: 305_000 });
  });

  it('is nothing paid while no hand was logged, and fails when the database refuses', async () => {
    expect(toHighHandTonight([])).toEqual({ handsPaid: 0, chipsPaid: 0, hits: [] });
    const { result } = renderTonight({ status: 400, body: { code: '42501', message: 'refused', details: null, hint: null } });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

/** A hook of this file over a fake API that answers every call with `reply`; what each call sent is kept. */
function renderOver<Hook>(hook: () => Hook, reply: { status?: number; body: unknown }) {
  const asked: unknown[] = [];
  const fetch: typeof globalThis.fetch = async (_input, init) => {
    asked.push(JSON.parse(String(init?.body)));
    return Response.json(reply.body, { status: reply.status ?? 200 });
  };
  const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
    global: { fetch },
    auth: { storage: sessionStorageFor(SIGNED_IN), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client} queryClient={queryClient}>{children}</RivrDataProvider>;
  return { result: renderHook(hook, { wrapper }).result, asked };
}

const REWARD = {
  kind: 'high_hand', rules: { bothHoleCards: true, shownAtShowdown: true, minPlayersDealt: 4 }, hands: [{ hand: 'royal_flush', chips: 25_000 }],
};

describe('the high hand that runs now (redesign RD-24)', () => {
  it('reads its name, its hands and its rules', async () => {
    const { result } = renderOver(() => useHighHandLive(CLUB), { body: [{ promotion_id: 'p9', name: 'High hand bonus', reward: REWARD }] });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toEqual({ promotionId: 'p9', name: 'High hand bonus', reward: REWARD });
  });

  it('is none while none runs, or when its reward cannot be read as a high hand', async () => {
    const none = renderOver(() => useHighHandLive(CLUB), { body: [] });
    await waitFor(() => expect(none.result.current.data).toBeNull());
    cleanup();
    const other = renderOver(() => useHighHandLive(CLUB), { body: [{ promotion_id: 'p1', name: 'Seat bonus', reward: { kind: 'seat_bonus', chips: 1_000 } }] });
    await waitFor(() => expect(other.result.current.data).toBeNull());
  });
});

const HIT = {
  tableId: 't2', memberId: 'm1', hand: 'royal_flush', rank: null, confirmed: { bothHoleCards: true, shownAtShowdown: true, playersDealt: true },
  requestId: '44400000-0000-4000-8000-000000000001',
} as const;

describe('logging a high hand (redesign RD-24)', () => {
  it('sends the hit with its request id, a hand with no rank as a blank', async () => {
    const { result, asked } = renderOver(() => useLogHighHand(CLUB), { body: 'h1' });
    const done = await act(() => result.current.mutateAsync(HIT));
    expect(done).toEqual({ ok: true, value: null });
    expect(asked[0]).toEqual({
      p_table_id: 't2', p_member_id: 'm1', p_hand: 'royal_flush', p_rank: '', p_confirmed: HIT.confirmed, p_request_id: HIT.requestId,
    });
  });

  it.each([
    ['42501', null, { reason: 'not_allowed', left: null }], ['RVOWN', null, { reason: 'own_record', left: null }],
    ['RVHHN', null, { reason: 'none_live', left: null }], ['RVHHS', null, { reason: 'not_seated', left: null }],
    ['RVHHE', null, { reason: 'not_eligible', left: null }], ['RVHHR', 'wrong_rank', { reason: 'rule', left: null }],
    ['RVHHB', '7000', { reason: 'over_budget', left: 7_000 }], ['RVKIL', null, { reason: 'paused', left: null }],
    ['XX000', null, { reason: 'unavailable', left: null }],
  ])('says why a hit was refused: %s', async (code, details, failure) => {
    const { result } = renderOver(() => useLogHighHand(CLUB), { status: 400, body: { code, message: 'refused', details, hint: null } });
    const done = await act(() => result.current.mutateAsync({ ...HIT, hand: 'four_of_a_kind', rank: 'jack' }));
    expect(done).toEqual({ ok: false, error: failure });
  });
});
