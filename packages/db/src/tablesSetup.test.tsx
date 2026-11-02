import { createClient } from '@supabase/supabase-js';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { useGivePoints, useMemberPoints, useMyLockedPoints } from './pointsByHand.ts';
import { RivrDataProvider } from './provider.tsx';
import { useGamesHistory, useTablesSetup, useTablesSetupActions } from './tablesSetup.ts';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

const STAFF = '00000000-0000-4000-8000-000000000134';
const VENUE = '00000000-0000-4000-8000-000000000001';

/** A fake API: each table or RPC answers with its reply; every call is kept with what it was sent. */
function renderSetup(replies: Record<string, { status?: number; body: unknown }>, phone: string | null = null) {
  const calls: { path: string; body: unknown }[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const path = url.pathname.replace('/rest/v1/', '').replace('rpc/', '');
    calls.push({ path, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const reply = replies[path];
    return Response.json(reply?.body ?? [], { status: reply?.status ?? 200 });
  };
  const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
    global: { fetch },
    auth: { storage: sessionStorageFor(STAFF), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client}>{children}</RivrDataProvider>;
  const { result } = renderHook(() => ({
    setup: useTablesSetup(VENUE), actions: useTablesSetupActions(VENUE), history: useGamesHistory(VENUE, '2026-10-30', '2026-11-01'),
    member: useMemberPoints(VENUE, phone), give: useGivePoints(VENUE), locked: useMyLockedPoints(),
  }), { wrapper });
  return { result, calls };
}

afterEach(cleanup);

describe('tables setup, games history and points by hand', () => {
  it('reads the stakes, an older one with its game and a newer one with none, and the tables', async () => {
    const { result } = renderSetup({
      table_type: { body: [{ id: 's1', name: 'NLH 50/100', game: 'nlh', small_blind_paise: 5000, big_blind_paise: 10000, straddle_paise: null },
        { id: 's2', name: '100/200', game: null, small_blind_paise: 10000, big_blind_paise: 20000, straddle_paise: 40000 }] },
      game_table: { body: [{ id: 't1', name: 'Table 1', table_type_id: 's1', seats: 9, is_open: true }] },
    });
    await waitFor(() => expect(result.current.setup.data).toEqual({
      stakes: [{ id: 's1', name: 'NLH 50/100', game: 'nlh', smallBlind: 5000n, bigBlind: 10000n, straddle: null },
        { id: 's2', name: '100/200', game: null, smallBlind: 10000n, bigBlind: 20000n, straddle: 40000n }],
      tables: [{ id: 't1', name: 'Table 1', stakeId: 's1', seats: 9, isOpen: true }],
    }));
  });

  it('adds a stake or changes one, and says why a table change was refused', async () => {
    const { result, calls } = renderSetup({ set_game_table: { status: 400, body: { code: 'RVSTD', message: 'Move the players' } } });
    let added: unknown;
    await act(async () => {
      added = await result.current.actions.saveStake.mutateAsync({ stakeId: null, name: ' 100/200 ', smallBlind: 10000n, bigBlind: 20000n, straddle: 40000n });
    });
    expect(added).toEqual({ ok: true, value: null });
    expect(calls.find((call) => call.path === 'add_table_type')?.body).toEqual({
      p_venue_id: VENUE, p_name: '100/200', p_small_blind_paise: 10000, p_big_blind_paise: 20000, p_straddle_paise: 40000,
    });
    await act(async () => {
      await result.current.actions.saveStake.mutateAsync({ stakeId: 's1', name: 'NLH 50/100', smallBlind: 5000n, bigBlind: 10000n, straddle: null });
    });
    expect(calls.find((call) => call.path === 'set_table_type')?.body).toEqual({
      p_type_id: 's1', p_name: 'NLH 50/100', p_small_blind_paise: 5000, p_big_blind_paise: 10000,
    });
    let refused: unknown;
    await act(async () => {
      await result.current.actions.saveTable.mutateAsync({ tableId: null, name: 'Table 9', stakeId: 's1', seats: 8 });
      refused = await result.current.actions.saveTable.mutateAsync({ tableId: 't1', name: 'Table 1', stakeId: 's2', seats: 9 });
    });
    expect(calls.find((call) => call.path === 'add_game_table')?.body).toEqual({ p_venue_id: VENUE, p_name: 'Table 9', p_table_type_id: 's1', p_seats: 8 });
    expect(refused).toEqual({ ok: false, error: 'players_seated' });
  });

  it('reads the games each club day ran', async () => {
    const { result } = renderSetup({
      games_history: { body: [{ club_day: '2026-10-31', table_id: 't1', table_name: 'Table 1', game: 'plo', small_blind_paise: 10000, big_blind_paise: 20000,
        runs: 2, seconds: 18000 }] },
    });
    await waitFor(() => expect(result.current.history.data).toEqual([
      { clubDay: '2026-10-31', tableId: 't1', tableName: 'Table 1', game: 'plo', smallBlind: 10000n, bigBlind: 20000n, runs: 2, seconds: 18000 },
    ]));
  });

  it('finds a member by number with their points, and gives, locks or unlocks them once a request', async () => {
    const { result, calls } = renderSetup({
      member_points: { body: [{ member_id: 'm1', full_name: 'Mihir Shah', member_number: 1213, earned: 120, locked: 500 }] },
      unlock_points: { status: 400, body: { code: 'RVPTS', message: 'Not enough locked points' } },
      my_locked_points: { body: 250 },
    }, '9000000213');
    await waitFor(() => expect(result.current.member.data).toEqual({ memberId: 'm1', fullName: 'Mihir Shah', memberNumber: 1213, earned: 120n, locked: 500n }));
    await waitFor(() => expect(result.current.locked.data).toBe(250n));
    let given: unknown;
    let unlocked: unknown;
    await act(async () => {
      given = await result.current.give.mutateAsync({ memberId: 'm1', action: 'locked', points: 300n, reason: ' Welcome ', requestId: 'r1' });
      unlocked = await result.current.give.mutateAsync({ memberId: 'm1', action: 'unlock', points: 900n, reason: 'Played the month', requestId: 'r2' });
    });
    expect(given).toEqual({ ok: true, value: null });
    expect(calls.find((call) => call.path === 'grant_points')?.body).toEqual({
      p_member_id: 'm1', p_points: 300, p_reason: 'Welcome', p_idempotency_key: 'r1', p_is_locked: true,
    });
    expect(unlocked).toEqual({ ok: false, error: 'not_enough_locked' });
  });
});
