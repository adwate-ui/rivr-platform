import { createClient } from '@supabase/supabase-js';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { RivrDataProvider } from './provider.tsx';
import { useTablesSetup, useTablesSetupActions } from './tablesSetup.ts';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

const STAFF = '00000000-0000-4000-8000-000000000134';
const VENUE = '00000000-0000-4000-8000-000000000001';

/** A fake API: each table or RPC answers with its reply; every call is kept with what it was sent. */
function renderSetup(replies: Record<string, { status?: number; body: unknown }>) {
  const calls: { path: string; body: unknown }[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const path = url.pathname.replace('/rest/v1/', '').replace('rpc/', '');
    calls.push({ path, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const reply = replies[path];
    return Response.json(reply === undefined ? [] : reply.body, { status: reply?.status ?? 200 });
  };
  const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
    global: { fetch },
    auth: { storage: sessionStorageFor(STAFF), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client}>{children}</RivrDataProvider>;
  const { result } = renderHook(() => ({ setup: useTablesSetup(VENUE), actions: useTablesSetupActions(VENUE) }), { wrapper });
  return { result, calls };
}

afterEach(cleanup);

describe('tables setup', () => {
  it('reads the stakes, an older one with its game and a newer one with none, and the tables', async () => {
    const { result } = renderSetup({
      table_type: { body: [{ id: 's1', name: 'NLH 50/100', game: 'nlh', small_blind_paise: 5000, big_blind_paise: 10000, straddle_paise: null },
        { id: 's2', name: '100/200', game: null, small_blind_paise: 10000, big_blind_paise: 20000, straddle_paise: 40000 }] },
      game_table: { body: [{ id: 't1', name: 'Table 1', table_type_id: 's1', seats: 9, is_open: true, active: true, min_buy_in_paise: 500000 },
        { id: 't4', name: 'Table 4', table_type_id: 's1', seats: 9, is_open: false, active: false, min_buy_in_paise: 735000 }] },
      // The newer stake has no call time yet, so the database sends 0 for it.
      stake_call_times: { body: [{ table_type_id: 's1', call_time_minutes: 180 }, { table_type_id: 's2', call_time_minutes: 0 }] },
    });
    await waitFor(() => expect(result.current.setup.data).toEqual({
      stakes: [{ id: 's1', name: 'NLH 50/100', game: 'nlh', smallBlind: 5000n, bigBlind: 10000n, straddle: null, callTimeMinutes: 180 },
        { id: 's2', name: '100/200', game: null, smallBlind: 10000n, bigBlind: 20000n, straddle: 40000n, callTimeMinutes: 0 }],
      tables: [{ id: 't1', name: 'Table 1', stakeId: 's1', seats: 9, minBuyIn: 500000n, isOpen: true, isActive: true, seated: 0, waiting: 0 },
        { id: 't4', name: 'Table 4', stakeId: 's1', seats: 9, minBuyIn: 735000n, isOpen: false, isActive: false, seated: 0, waiting: 0 }],
    }));
  });

  it('counts who keeps each table in play: the players seated, and the places waiting on its list or called to it', async () => {
    const { result, calls } = renderSetup({
      game_table: { body: [{ id: 't1', name: 'Table 1', table_type_id: 's1', seats: 9, is_open: true, active: true, min_buy_in_paise: 500000 },
        { id: 't2', name: 'Table 2', table_type_id: 's1', seats: 9, is_open: true, active: true, min_buy_in_paise: 500000 }] },
      seat_session: { body: [{ table_id: 't1' }, { table_id: 't1' }] },
      waitlist_entry: { body: [{ table_id: 't1', call_table_id: null }, { table_id: 't1', call_table_id: 't2' }, { table_id: 't2', call_table_id: 't2' }] },
    });
    await waitFor(() => expect(result.current.setup.data?.tables.map(({ id, seated, waiting }) => ({ id, seated, waiting }))).toEqual([
      { id: 't1', seated: 2, waiting: 2 }, { id: 't2', seated: 0, waiting: 2 },
    ]));
    expect(calls.map((call) => call.path)).toEqual(expect.arrayContaining(['seat_session', 'waitlist_entry']));
  });

  it('adds a stake or changes one, with its call time, and says why a table change was refused', async () => {
    const { result, calls } = renderSetup({ set_game_table: { status: 400, body: { code: 'RVSTD', message: 'Move the players' } } });
    let added: unknown;
    await act(async () => {
      added = await result.current.actions.saveStake.mutateAsync({ stakeId: null, name: ' 100/200 ', smallBlind: 10000n, bigBlind: 20000n, straddle: 40000n, callTimeMinutes: 240 });
    });
    expect(added).toEqual({ ok: true, value: null });
    expect(calls.find((call) => call.path === 'add_table_type')?.body).toEqual({
      p_venue_id: VENUE, p_name: '100/200', p_small_blind_paise: 10000, p_big_blind_paise: 20000, p_straddle_paise: 40000, p_call_time_minutes: 240,
    });
    await act(async () => {
      await result.current.actions.saveStake.mutateAsync({ stakeId: 's1', name: 'NLH 50/100', smallBlind: 5000n, bigBlind: 10000n, straddle: null, callTimeMinutes: null });
    });
    expect(calls.find((call) => call.path === 'set_table_type')?.body).toEqual({
      // No call time sent: the stake keeps its own.
      p_type_id: 's1', p_name: 'NLH 50/100', p_small_blind_paise: 5000, p_big_blind_paise: 10000, p_straddle_paise: 0,
    });
    let refused: unknown;
    await act(async () => {
      await result.current.actions.saveTable.mutateAsync({ tableId: null, name: 'Table 9', stakeId: 's1', seats: 8, minBuyIn: 735000n });
      refused = await result.current.actions.saveTable.mutateAsync({ tableId: 't1', name: 'Table 1', stakeId: 's2', seats: 9, minBuyIn: 1000000n });
    });
    expect(calls.find((call) => call.path === 'add_game_table')?.body).toEqual({
      p_venue_id: VENUE, p_name: 'Table 9', p_table_type_id: 's1', p_seats: 8, p_min_buy_in_paise: 735000,
    });
    expect(calls.find((call) => call.path === 'set_game_table')?.body).toEqual({
      p_table_id: 't1', p_name: 'Table 1', p_table_type_id: 's2', p_seats: 9, p_min_buy_in_paise: 1000000,
    });
    expect(refused).toEqual({ ok: false, error: 'players_seated' });
  });

  it('says a table was given a stake that has no call time yet (redesign RD-16)', async () => {
    const { result } = renderSetup({ add_game_table: { status: 400, body: { code: 'RVNCT', message: 'Give the stake a call time before a table plays it' } } });
    let refused: unknown;
    await act(async () => {
      refused = await result.current.actions.saveTable.mutateAsync({ tableId: null, name: 'Table 9', stakeId: 's2', seats: 9, minBuyIn: 1000000n });
    });
    expect(refused).toEqual({ ok: false, error: 'stake_without_call_time' });
  });

  it('deletes a stake, and says when a table still uses it (redesign RD-17)', async () => {
    const { result, calls } = renderSetup({});
    let deleted: unknown;
    await act(async () => { deleted = await result.current.actions.removeStake.mutateAsync('s2'); });
    expect(deleted).toEqual({ ok: true, value: null });
    expect(calls.find((call) => call.path === 'delete_table_type')?.body).toEqual({ p_type_id: 's2' });
    const refusing = renderSetup({ delete_table_type: { status: 400, body: { code: 'RVUSE', message: 'A table still uses that stake' } } });
    let refused: unknown;
    await act(async () => { refused = await refusing.result.current.actions.removeStake.mutateAsync('s1'); });
    expect(refused).toEqual({ ok: false, error: 'stake_in_use' });
  });

  it('deactivates, reactivates and deletes a table, and says why one was refused (decision 0466)', async () => {
    const { result, calls } = renderSetup({
      deactivate_game_table: { status: 400, body: { code: 'RVWTG', message: 'Take the players off its waitlist first' } },
      delete_game_table: { status: 400, body: { code: 'RVSTD', message: 'Move the players' } },
    });
    let outcomes: unknown[] = [];
    await act(async () => {
      outcomes = [
        await result.current.actions.deactivate.mutateAsync('t1'),
        await result.current.actions.reactivate.mutateAsync('t4'),
        await result.current.actions.remove.mutateAsync('t1'),
      ];
    });
    expect(outcomes).toEqual([{ ok: false, error: 'players_waiting' }, { ok: true, value: null }, { ok: false, error: 'players_seated' }]);
    expect(calls.filter((call) => call.path.endsWith('_game_table')).map((call) => [call.path, call.body])).toEqual([
      ['deactivate_game_table', { p_table_id: 't1' }], ['reactivate_game_table', { p_table_id: 't4' }], ['delete_game_table', { p_table_id: 't1' }],
    ]);
  });
});
