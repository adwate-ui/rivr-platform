import { createClient } from '@supabase/supabase-js';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { useMySeat, useMySeatActions } from './mySeat.ts';
import { RivrDataProvider } from './provider.tsx';
import { useSetTopUp } from './seats.ts';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

const SIGNED_IN = '00000000-0000-4000-8000-000000000211';
const VENUE = '00000000-0000-4000-8000-000000000001';

/** A fake API: each RPC answers with its reply; every call is kept with what it was sent. */
function renderSeat(replies: Record<string, { status?: number; body: unknown }>) {
  const calls: { rpc: string; body: unknown }[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const rpc = (input instanceof Request ? input.url : String(input)).split('/rpc/')[1] ?? '';
    calls.push({ rpc, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const reply = replies[rpc];
    return Response.json(reply?.body ?? null, { status: reply?.status ?? 200 });
  };
  const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
    global: { fetch },
    auth: { storage: sessionStorageFor(SIGNED_IN), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client}>{children}</RivrDataProvider>;
  const { result } = renderHook(() => ({ seat: useMySeat(), actions: useMySeatActions(), setTopUp: useSetTopUp(VENUE) }), { wrapper });
  return { result, calls };
}

const SEAT = {
  table_name: 'Table 3', seat: 2, is_away: false, has_call_time: true, call_time_left: 10800, played_seconds: 600, is_leaving: false,
  top_up: 'requested',
};

afterEach(cleanup);

describe('the member at the table', () => {
  it('reads how long they have played, the Leaving list and their top-up', async () => {
    const { result } = renderSeat({ my_seat: { body: [SEAT] } });
    await waitFor(() => expect(result.current.seat.data).toEqual({
      tableName: 'Table 3', seat: 2, isAway: false, hasCallTime: true, callTimeLeft: 10800, playedSeconds: 600, isLeaving: false, topUp: 'requested',
    }));
  });

  it('reads an unknown top-up as none', async () => {
    const { result } = renderSeat({ my_seat: { body: [{ ...SEAT, top_up: null }] } });
    await waitFor(() => expect(result.current.seat.data?.topUp).toBeNull());
  });

  it('extends call time, asks for a top-up and leaves, each a Result', async () => {
    const { result } = renderSeat({
      my_seat: { body: [SEAT] },
      leave_my_seat: { body: 'leaving' },
      request_top_up: { status: 400, body: { code: '42501', message: 'not open' } },
      extend_my_call_time: { status: 400, body: { code: '22023', message: 'not seated' } },
    });
    let outcomes: unknown[] = [];
    await act(async () => {
      outcomes = [await result.current.actions.leave.mutateAsync(), await result.current.actions.requestTopUp.mutateAsync(),
        await result.current.actions.extend.mutateAsync()];
    });
    expect(outcomes).toEqual([{ ok: true, value: 'leaving' }, { ok: false, error: 'not_allowed' }, { ok: false, error: 'not_seated' }]);
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
