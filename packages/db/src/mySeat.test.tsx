import { createClient } from '@supabase/supabase-js';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { useMySeat, useMySeatActions, useMyTablemates } from './mySeat.ts';
import { RivrDataProvider } from './provider.tsx';
import { useSetTopUp } from './seats.ts';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

const SIGNED_IN = '00000000-0000-4000-8000-000000000211';
const VENUE = '00000000-0000-4000-8000-000000000001';

/** A fake API: each RPC answers with its reply; every call is kept with what it was sent. */
function renderSeat(replies: Record<string, { status?: number; body: unknown }>) {
  const calls: { rpc: string; body: unknown }[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const rpc = (input instanceof Request ? input.url : String(input)).split('/rpc/')[1]?.split('?')[0] ?? '';
    calls.push({ rpc, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const reply = replies[rpc];
    return Response.json(reply?.body ?? null, { status: reply?.status ?? 200 });
  };
  const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
    global: { fetch },
    auth: { storage: sessionStorageFor(SIGNED_IN), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client}>{children}</RivrDataProvider>;
  const { result } = renderHook(() => ({ seat: useMySeat(), actions: useMySeatActions(), setTopUp: useSetTopUp(VENUE), tablemates: useMyTablemates(true) }), { wrapper });
  return { result, calls };
}

const SEAT = {
  table_name: 'Table 3', seat: 2, is_away: false, has_call_time: true, call_time_left: 10800, played_seconds: 600, is_leaving: false,
  top_up: 'requested', call_time_ends_at: '2026-11-15T20:00:00+00:00', table_type_name: 'NLH 100/200', small_blind_paise: 10000,
  big_blind_paise: 20000, game: 'nlh', straddle_paise: 50000,
};

afterEach(cleanup);

describe('the member at the table', () => {
  it('reads how long they have played, the Leaving list and their top-up', async () => {
    const { result } = renderSeat({ my_seat: { body: [SEAT] } });
    await waitFor(() => expect(result.current.seat.data).toEqual({
      tableName: 'Table 3', seat: 2, isAway: false, hasCallTime: true, callTimeLeft: 10800, playedSeconds: 600, isLeaving: false, topUp: 'requested',
      callTimeEndsAt: '2026-11-15T20:00:00+00:00', tableTypeName: 'NLH 100/200', game: 'nlh', smallBlind: 10000n, bigBlind: 20000n, straddle: 50000n,
    }));
  });

  it('reads a stake that names no game as NLH, as the console does', async () => {
    const { result } = renderSeat({ my_seat: { body: [{ ...SEAT, table_type_name: '100/200', game: null }] } });
    await waitFor(() => expect(result.current.seat.data?.game).toBe('nlh'));
  });

  it('reads an unknown top-up as none', async () => {
    const { result } = renderSeat({ my_seat: { body: [{ ...SEAT, top_up: null }] } });
    await waitFor(() => expect(result.current.seat.data?.topUp).toBeNull());
  });

  it('sets the call time to a time, asks for a top-up, and leaves, each a Result (decision 0320; the owner, 22 Nov)', async () => {
    const { result, calls } = renderSeat({
      my_seat: { body: [SEAT] },
      leave_my_seat: { body: 'leaving' },
      request_top_up: { status: 400, body: { code: '42501', message: 'not open' } },
      set_my_call_time: { status: 400, body: { code: 'RVCTE', message: 'too early' } },
    });
    let outcomes: unknown[] = [];
    await act(async () => {
      outcomes = [await result.current.actions.leave.mutateAsync(), await result.current.actions.requestTopUp.mutateAsync(),
        await result.current.actions.setCallTime.mutateAsync({ until: new Date('2026-11-22T18:10:00.000Z'), requestId: 'r1' })];
    });
    expect(outcomes).toEqual([{ ok: true, value: 'leaving' }, { ok: false, error: 'not_allowed' }, { ok: false, error: 'too_early' }]);
    expect(calls.find((call) => call.rpc === 'set_my_call_time')?.body).toEqual({ p_until: '2026-11-22T18:10:00.000Z', p_idempotency_key: 'r1' });
  });

  it('reads the others at the table: until when once set, else not set, away or done (the owner, 22 Nov)', async () => {
    const { result } = renderSeat({
      my_tablemates: { body: [
        { seat: 3, first_name: 'Ritika', call_time: 'until', ends_at: '2026-11-22T18:10:00+00:00' },
        { seat: 4, first_name: null, call_time: 'away', ends_at: null },
        { seat: 5, first_name: 'Yash', call_time: 'not_set', ends_at: null },
        { seat: 6, first_name: 'Mihir', call_time: 'done', ends_at: null },
        { seat: 7, first_name: 'Kabir', call_time: 'until', ends_at: null },
      ] },
    });
    await waitFor(() => expect(result.current.tablemates.data).toEqual([
      { seat: 3, firstName: 'Ritika', callTime: { kind: 'until', endsAt: '2026-11-22T18:10:00+00:00' } },
      { seat: 4, firstName: null, callTime: { kind: 'away' } },
      { seat: 5, firstName: 'Yash', callTime: { kind: 'not_set' } },
      { seat: 6, firstName: 'Mihir', callTime: { kind: 'done' } },
      { seat: 7, firstName: 'Kabir', callTime: { kind: 'not_set' } },
    ]));
  });

  it('leaves at once with call time done, and names a frozen account', async () => {
    const { result } = renderSeat({ leave_my_seat: { body: 'left' }, request_top_up: { status: 400, body: { code: 'RVMBR', message: 'frozen' } } });
    let outcomes: unknown[] = [];
    await act(async () => { outcomes = [await result.current.actions.leave.mutateAsync(), await result.current.actions.requestTopUp.mutateAsync()]; });
    expect(outcomes).toEqual([{ ok: true, value: 'left' }, { ok: false, error: 'stopped' }]);
  });

  it('lets the floor take a top-up in hand', async () => {
    const { result, calls } = renderSeat({});
    let outcome: unknown;
    await act(async () => { outcome = await result.current.setTopUp.mutateAsync({ sessionId: 's1', inProgress: true }); });
    expect(outcome).toEqual({ ok: true, value: null });
    expect(calls.find((call) => call.rpc === 'set_top_up')?.body).toEqual({ p_session_id: 's1', p_in_progress: true });
  });
});
