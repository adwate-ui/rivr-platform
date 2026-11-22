import { createClient } from '@supabase/supabase-js';
import { QueryClient } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  useAddBonusUse, useBonusUseSeats, useGiveBonusChips, useMemberBonus, useMemberBonusHistory, useMemberBonusVisitLeft, useMyBonus, useMyBonusHistory,
  useReverseBonus, useUseBonus,
} from './bonus.ts';
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
  return { wrapper, calls, queryClient };
}

const LINES = [
  { line_id: 'r1', at: '2026-11-15T18:00:00Z', kind: 'redeemed', amount_paise: 100_000, reason: null, table_name: 'Table 3', staff_name: 'Aditya Malhotra' },
  { line_id: 'g1', at: '2026-11-14T18:00:00Z', kind: 'credited', amount_paise: 150_000, reason: 'Welcome', table_name: null, staff_name: null },
];

afterEach(cleanup);

describe('Bonus', () => {
  it('reads the member\'s balance and their newest lines, as many as asked for', async () => {
    const { wrapper, calls } = clientFor({
      '/rpc/my_bonus_history': { body: LINES.map(({ staff_name: _, ...line }) => line) },
      '/rpc/my_bonus': { body: [{ bonus_paise: 50_000, expiry_days: 30, bonus_line: 'Play it on any table tonight.' }] },
    });
    const { result } = renderHook(() => ({ bonus: useMyBonus(), history: useMyBonusHistory(20) }), { wrapper });
    // The balance and the card's line; never when Bonus expires (#1079).
    await waitFor(() => expect(result.current.bonus.data).toEqual({ balance: 50_000n, line: 'Play it on any table tonight.' }));
    await waitFor(() => expect(result.current.history.data).toEqual([
      { id: 'r1', at: '2026-11-15T18:00:00Z', kind: 'redeemed', amount: 100_000n, reason: null, tableName: 'Table 3', highHand: null },
      { id: 'g1', at: '2026-11-14T18:00:00Z', kind: 'credited', amount: 150_000n, reason: 'Welcome', tableName: null, highHand: null },
    ]));
    expect(calls.find((call) => call.url.includes('/rpc/my_bonus_history'))?.body).toEqual({ p_limit: 20 });
  });

  it('reads the hand of a line a high hand paid (redesign RD-25)', async () => {
    const paid = { line_id: 'g9', at: '2026-11-15T21:13:00Z', kind: 'credited', amount_paise: 1_000_000, reason: 'High hand bonus', table_name: null };
    const { wrapper } = clientFor({
      '/rpc/my_bonus_history': { body: [{ ...paid, hand: 'straight_flush', rank: 'nine' }, { ...paid, line_id: 'g8', hand: 'royal_flush', rank: null }, { ...paid, line_id: 'g7', hand: null, rank: null }] },
    });
    const { result } = renderHook(() => useMyBonusHistory(3), { wrapper });
    await waitFor(() => expect(result.current.data?.map((line) => line.highHand)).toEqual([
      { hand: 'straight_flush', rank: 'nine' }, { hand: 'royal_flush', rank: null }, null,
    ]));
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

  // Decision 0579: what the member's visit may still redeem under the club's cap.
  it('reads what a member\'s visit may still redeem, and none where the club sets no cap', async () => {
    const capped = clientFor({ '/rpc/member_bonus_visit_left': { body: [{ left_paise: 300_000 }] } });
    const left = renderHook(() => useMemberBonusVisitLeft(VENUE, MEMBER), { wrapper: capped.wrapper });
    await waitFor(() => expect(left.result.current.data).toBe(300_000n));
    expect(capped.calls.find((call) => call.url.includes('/rpc/member_bonus_visit_left'))?.body).toEqual({ p_venue_id: VENUE, p_member_id: MEMBER });
    const open = clientFor({ '/rpc/member_bonus_visit_left': { body: [{ left_paise: null }] } });
    const none = renderHook(() => useMemberBonusVisitLeft(VENUE, MEMBER), { wrapper: open.wrapper });
    await waitFor(() => expect(none.result.current.isSuccess).toBe(true));
    expect(none.result.current.data).toBeNull();
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

  it('adds Bonus by hand with a reason and the request id, and says why it is refused (owner, 8 Nov)', async () => {
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

  it('uses Bonus without a seat with a reason and the request id, and says why it is refused (the owner, 20 Nov)', async () => {
    const done = clientFor({ '/rpc/use_bonus': { body: 'u9' } });
    const readAgain = vi.spyOn(done.queryClient, 'invalidateQueries');
    const used = renderHook(() => useUseBonus(VENUE, MEMBER), { wrapper: done.wrapper });
    let outcome: unknown;
    await act(async () => { outcome = await used.result.current.mutateAsync({ chips: 200, reason: 'Chips for the bar', requestId: 'u9' }); });
    expect(outcome).toEqual({ ok: true, value: null });
    expect(done.calls.find((call) => call.url.includes('/rpc/use_bonus'))?.body)
      .toEqual({ p_member_id: MEMBER, p_chips: 200, p_reason: 'Chips for the bar', p_request_id: 'u9' });
    // The member's balance and histories (under memberBonus), the door and Players visits.
    expect(readAgain.mock.calls.map(([filters]) => filters?.queryKey?.slice(2))).toEqual([['bonus', VENUE, MEMBER], ['door-board', VENUE], ['player-visits', VENUE]]);
    const refusals = [['RVBON', 'bonus_short'], ['RVVCP', 'visit_cap'], ['RVCHP', 'invalid_chips'], ['22023', 'invalid_reason'],
      ['RVOWN', 'own_record'], ['42501', 'not_allowed'], ['RVMBR', 'paused'], ['RVRAT', 'busy'], ['XX000', 'unavailable']] as const;
    for (const [code, failure] of refusals) {
      const refused = clientFor({ '/rpc/use_bonus': { status: 400, body: { code, message: 'no' } } });
      const hook = renderHook(() => useUseBonus(VENUE, MEMBER), { wrapper: refused.wrapper });
      await act(async () => { outcome = await hook.result.current.mutateAsync({ chips: 200, reason: 'Chips for the bar', requestId: 'u8' }); });
      expect(outcome).toEqual({ ok: false, error: failure });
    }
  });

  it('reverses a Bonus given, reads the seats a missed use may go to, and adds one (the owner, 18 Nov)', async () => {
    const done = clientFor({
      '/rpc/reverse_bonus': { body: 200_000 },
      '/rpc/bonus_use_seats': { body: [{ session_id: 's7', table_name: 'Table 5', seat: 7, started_at: '2026-11-18T16:40:00Z', ended_at: null }] },
      '/rpc/add_bonus_use': { body: 'u1' },
    });
    const hooks = renderHook(() => ({ reverse: useReverseBonus(VENUE, MEMBER), seats: useBonusUseSeats(VENUE, MEMBER, 10), add: useAddBonusUse(VENUE, MEMBER) }),
      { wrapper: done.wrapper });
    let outcome: unknown;
    await act(async () => { outcome = await hooks.result.current.reverse.mutateAsync({ grantId: 'g1', reason: 'Wrong member' }); });
    expect(outcome).toEqual({ ok: true, value: 200_000n });
    expect(done.calls.find((call) => call.url.includes('/rpc/reverse_bonus'))?.body).toEqual({ p_grant_id: 'g1', p_reason: 'Wrong member' });
    await waitFor(() => expect(hooks.result.current.seats.data).toEqual([{ sessionId: 's7', tableName: 'Table 5', seat: 7, startedAt: '2026-11-18T16:40:00Z', endedAt: null }]));
    expect(done.calls.find((call) => call.url.includes('/rpc/bonus_use_seats'))?.body).toEqual({ p_venue_id: VENUE, p_member_id: MEMBER, p_limit: 10 });
    await act(async () => { outcome = await hooks.result.current.add.mutateAsync({ sessionId: 's7', chips: 1500, reason: 'Missed at the seat', requestId: 'u1' }); });
    expect(outcome).toEqual({ ok: true, value: null });
    expect(done.calls.find((call) => call.url.includes('/rpc/add_bonus_use'))?.body)
      .toEqual({ p_session_id: 's7', p_chips: 1500, p_reason: 'Missed at the seat', p_request_id: 'u1' });
  });

  it('says why a reversal or a missed use is refused, and a cashier\'s missed use past the Bonus held', async () => {
    let outcome: unknown;
    const refusals = [['RVOWN', 'own_record'], ['42501', 'not_allowed'], ['22023', 'invalid'], ['RVCHP', 'invalid_chips'], ['RVNIL', 'nothing_left'],
      ['RVKIL', 'paused'], ['RVRAT', 'busy'], ['XX000', 'unavailable']] as const;
    for (const [code, failure] of refusals) {
      const refusal = { status: 400, body: { code, message: 'no' } };
      const refused = clientFor({ '/rpc/reverse_bonus': refusal, '/rpc/add_bonus_use': refusal });
      const hooks = renderHook(() => ({ reverse: useReverseBonus(VENUE, MEMBER), add: useAddBonusUse(VENUE, MEMBER) }), { wrapper: refused.wrapper });
      await act(async () => { outcome = await hooks.result.current.reverse.mutateAsync({ grantId: 'g1', reason: 'Wrong member' }); });
      expect(outcome).toEqual({ ok: false, error: failure });
      await act(async () => { outcome = await hooks.result.current.add.mutateAsync({ sessionId: 's7', chips: 75, reason: 'Missed', requestId: 'u2' }); });
      expect(outcome).toEqual({ ok: false, error: failure });
    }
    const short = clientFor({ '/rpc/add_bonus_use': { status: 400, body: { code: 'RVBON', message: 'no' } } });
    const add = renderHook(() => useAddBonusUse(VENUE, MEMBER), { wrapper: short.wrapper });
    await act(async () => { outcome = await add.result.current.mutateAsync({ sessionId: 's7', chips: 75, reason: 'Missed', requestId: 'u3' }); });
    expect(outcome).toEqual({ ok: false, error: 'bonus_short' });
  });

  it('reads a reversal as a line of its own kind', async () => {
    const reversed = { line_id: 'g1', at: '2026-11-18T18:00:00Z', kind: 'reversed', amount_paise: 150_000, reason: 'Wrong member', table_name: null, staff_name: 'Vikram Rao' };
    const { wrapper } = clientFor({ '/rpc/member_bonus_history': { body: [reversed] } });
    const history = renderHook(() => useMemberBonusHistory(VENUE, MEMBER, 20), { wrapper });
    await waitFor(() => expect(history.result.current.data?.map((line) => [line.kind, line.reason, line.staffName])).toEqual([['reversed', 'Wrong member', 'Vikram Rao']]));
  });
});
