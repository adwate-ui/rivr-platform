import { createClient } from '@supabase/supabase-js';
import { QueryClient } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { useDecideBonus, useWaitingBonusPage } from './bonusApprovals.ts';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { RivrDataProvider } from './provider.tsx';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

const SIGNED_IN = '00000000-0000-4000-8000-000000000101';
const VENUE = '00000000-0000-4000-8000-000000000001';
const REQUEST = '00000000-0000-4000-8000-000000510001';

/** A fake API: each path answers with its reply; every call is kept with what it sent. */
function clientFor(replies: Record<string, { status?: number; body: unknown }>) {
  const calls: { url: string; body: unknown }[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const path = Object.keys(replies).find((key) => url.includes(key));
    const reply = path ? replies[path] : undefined;
    return Response.json(reply?.body ?? null, { status: reply?.status ?? 200 });
  };
  const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
    global: { fetch },
    auth: { storage: sessionStorageFor(SIGNED_IN), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client} queryClient={queryClient}>{children}</RivrDataProvider>;
  return { wrapper, calls };
}

const VIEW = { sort: null, query: '', filters: {}, page: 1 } as const;

const ROW = {
  total: 3, grant_id: 'g1', member_id: 'm1', full_name: 'Ishaan Verma', member_number: 7, promotion_id: 'p1', promotion_name: 'Four-hour bonus',
  amount_paise: 100_000, trigger: 'hours_step', event_at: '2026-11-15T18:00:00Z', step_minutes: 240, table_name: null, club_day: '2026-11-15',
};

afterEach(cleanup);

describe('Bonus to approve (decision 0670)', () => {
  it('reads a page of the waiting Bonus, in paise, with how many wait in all', async () => {
    const { wrapper, calls } = clientFor({ '/rpc/bonus_waiting_page': { body: [ROW] } });
    const { result } = renderHook(() => useWaitingBonusPage(VENUE, VIEW), { wrapper });
    await waitFor(() => expect(result.current.data?.total).toBe(3));
    expect(result.current.data?.rows).toEqual([{
      grantId: 'g1', memberId: 'm1', fullName: 'Ishaan Verma', memberNumber: 7, promotionName: 'Four-hour bonus', amount: 100_000n,
      trigger: 'hours_step', eventAt: '2026-11-15T18:00:00Z', stepMinutes: 240, tableName: null,
    }]);
    expect(calls[0]?.body).toMatchObject({ p_venue_id: VENUE, p_view: { page: 1, page_size: 50 } });
  });

  it('approves the chosen with a request id, and says how many, how much and how many a frozen member left waiting', async () => {
    const { wrapper, calls } = clientFor({ '/rpc/approve_promotion_bonus': { body: [{ decision_id: 'd1', grants: 2, amount_paise: 150_000, left_waiting: 1 }] } });
    const { result } = renderHook(() => useDecideBonus(VENUE), { wrapper });
    let outcome: Awaited<ReturnType<typeof result.current.mutateAsync>> | undefined;
    await act(async () => { outcome = await result.current.mutateAsync({ grantIds: ['g1', 'g2'], requestId: REQUEST, refusal: null }); });
    expect(outcome).toEqual({ ok: true, value: { grants: 2, amount: 150_000n, leftWaiting: 1 } });
    expect(calls.find((call) => call.url.includes('approve_promotion_bonus'))?.body).toEqual({ p_venue_id: VENUE, p_grant_ids: ['g1', 'g2'], p_request_id: REQUEST });
  });

  it('refuses with the reason trimmed', async () => {
    const { wrapper, calls } = clientFor({ '/rpc/refuse_promotion_bonus': { body: [{ decision_id: 'd2', grants: 1, amount_paise: 50_000 }] } });
    const { result } = renderHook(() => useDecideBonus(VENUE), { wrapper });
    await act(async () => { await result.current.mutateAsync({ grantIds: ['g1'], requestId: REQUEST, refusal: '  Signed up twice ' }); });
    expect(calls.find((call) => call.url.includes('refuse_promotion_bonus'))?.body).toEqual({
      p_venue_id: VENUE, p_grant_ids: ['g1'], p_reason: 'Signed up twice', p_request_id: REQUEST,
    });
  });

  it('names why a decision was refused', async () => {
    const { wrapper } = clientFor({ '/rpc/approve_promotion_bonus': { status: 400, body: { code: 'RVOWN', message: 'Nobody approves their own' } } });
    const { result } = renderHook(() => useDecideBonus(VENUE), { wrapper });
    let outcome: Awaited<ReturnType<typeof result.current.mutateAsync>> | undefined;
    await act(async () => { outcome = await result.current.mutateAsync({ grantIds: ['g1'], requestId: REQUEST, refusal: null }); });
    expect(outcome).toEqual({ ok: false, error: 'own_record' });
  });
});
