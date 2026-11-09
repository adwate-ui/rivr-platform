import { createClient } from '@supabase/supabase-js';
import { QueryClient } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { useGiveBonusChips, useMemberBonus, useMemberBonusHistory, useMyBonus, useMyBonusHistory } from './bonus.ts';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { RivrDataProvider } from './provider.tsx';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

const SIGNED_IN = '00000000-0000-4000-8000-0000000d0711';
const VENUE = '00000000-0000-4000-8000-000000000001';
const MEMBER = '00000000-0000-4000-8000-000000000211';

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
  // No retries, so a refusal is an error at once.
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client} queryClient={queryClient}>{children}</RivrDataProvider>;
  return { wrapper, calls };
}

const LINES = [
  { line_id: 'r1', at: '2026-11-15T18:00:00Z', kind: 'redeemed', amount_paise: 100_000, reason: null, table_name: 'Table 3', staff_name: 'Aditya Malhotra' },
  { line_id: 'g1', at: '2026-11-14T18:00:00Z', kind: 'credited', amount_paise: 150_000, reason: 'Welcome', table_name: null, staff_name: null },
];

afterEach(cleanup);

describe('bonus chips', () => {
  it('reads the member\'s balance and their newest lines, as many as asked for', async () => {
    const { wrapper, calls } = clientFor({
      '/rpc/my_bonus_history': { body: LINES.map(({ staff_name: _, ...line }) => line) },
      '/rpc/my_bonus': { body: [{ bonus_paise: 50_000 }] },
    });
    const { result } = renderHook(() => ({ bonus: useMyBonus(), history: useMyBonusHistory(20) }), { wrapper });
    await waitFor(() => expect(result.current.bonus.data).toBe(50_000n));
    await waitFor(() => expect(result.current.history.data).toEqual([
      { id: 'r1', at: '2026-11-15T18:00:00Z', kind: 'redeemed', amount: 100_000n, reason: null, tableName: 'Table 3' },
      { id: 'g1', at: '2026-11-14T18:00:00Z', kind: 'credited', amount: 150_000n, reason: 'Welcome', tableName: null },
    ]));
    expect(calls.find((call) => call.url.includes('/rpc/my_bonus_history'))?.body).toEqual({ p_limit: 20 });
  });

  it('gives no balance to someone who is no member', async () => {
    const { wrapper } = clientFor({ '/rpc/my_bonus': { body: [] } });
    const { result } = renderHook(() => useMyBonus(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });

  it('reads a member\'s balance and history for staff, with who seated them', async () => {
    const { wrapper, calls } = clientFor({
      '/rpc/member_bonus_history': { body: LINES },
      '/rpc/member_bonus': { body: [{ bonus_paise: 50_000 }] },
    });
    const { result } = renderHook(() => ({ bonus: useMemberBonus(VENUE, MEMBER), history: useMemberBonusHistory(VENUE, MEMBER, 20) }), { wrapper });
    await waitFor(() => expect(result.current.bonus.data).toBe(50_000n));
    await waitFor(() => expect(result.current.history.data?.[0]).toMatchObject({ kind: 'redeemed', amount: 100_000n, staffName: 'Aditya Malhotra' }));
    expect(calls.find((call) => call.url.includes('/rpc/member_bonus?') || call.url.endsWith('/rpc/member_bonus'))?.body)
      .toEqual({ p_venue_id: VENUE, p_member_id: MEMBER });
  });

  it('asks nothing until the seat sheet knows the member', async () => {
    const { wrapper, calls } = clientFor({ '/rpc/member_bonus': { body: [{ bonus_paise: 0 }] } });
    const { result } = renderHook(() => useMemberBonus(VENUE, null), { wrapper });
    await waitFor(() => expect(result.current.fetchStatus).toBe('idle'));
    expect(calls.some((call) => call.url.includes('/rpc/member_bonus'))).toBe(false);
  });

  it('fails a read the server refuses', async () => {
    const { wrapper } = clientFor({ '/rpc/my_bonus': { status: 500, body: { code: 'XX000', message: 'down' } } });
    const { result } = renderHook(() => useMyBonus(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('adds bonus chips by hand with a reason and the request id, and says why it is refused (owner, 8 Nov)', async () => {
    const done = clientFor({ '/rpc/give_bonus_chips': { body: 'g9' } });
    const added = renderHook(() => useGiveBonusChips(VENUE, MEMBER), { wrapper: done.wrapper });
    let outcome: unknown;
    await act(async () => { outcome = await added.result.current.mutateAsync({ chips: 500, reason: 'Birthday', requestId: 'r-1' }); });
    expect(outcome).toEqual({ ok: true, value: null });
    expect(done.calls.find((call) => call.url.includes('/rpc/give_bonus_chips'))?.body)
      .toEqual({ p_member_id: MEMBER, p_chips: 500, p_reason: 'Birthday', p_request_id: 'r-1' });
    const capped = clientFor({ '/rpc/give_bonus_chips': { body: null } });
    const overLimit = renderHook(() => useGiveBonusChips(VENUE, MEMBER), { wrapper: capped.wrapper });
    await act(async () => { outcome = await overLimit.result.current.mutateAsync({ chips: 500, reason: 'Birthday', requestId: 'r-3' }); });
    expect(outcome).toEqual({ ok: false, error: 'daily_limit' });
    for (const [code, failure] of [['RVCHP', 'invalid_chips'], ['RVOWN', 'own_record'], ['42501', 'not_allowed'], ['XX000', 'unavailable']] as const) {
      const refused = clientFor({ '/rpc/give_bonus_chips': { status: 400, body: { code, message: 'no' } } });
      const hook = renderHook(() => useGiveBonusChips(VENUE, MEMBER), { wrapper: refused.wrapper });
      await act(async () => { outcome = await hook.result.current.mutateAsync({ chips: 75, reason: 'Birthday', requestId: 'r-2' }); });
      expect(outcome).toEqual({ ok: false, error: failure });
    }
  });
});
