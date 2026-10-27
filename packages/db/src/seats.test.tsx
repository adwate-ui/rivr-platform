import { createClient } from '@supabase/supabase-js';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { RivrDataProvider } from './provider.tsx';
import { useLeftOwingCallTime, useSeatActions } from './seats.ts';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

const STAFF = '00000000-0000-4000-8000-000000000103';
const VENUE = '00000000-0000-4000-8000-000000000001';

/** A fake API: each RPC answers with its reply; every call is kept with what it was sent. */
function renderSeats(replies: Record<string, { status?: number; body: unknown }>) {
  const calls: { rpc: string; body: unknown }[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const rpc = (input instanceof Request ? input.url : String(input)).split('/rpc/')[1] ?? '';
    calls.push({ rpc, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const reply = replies[rpc];
    return Response.json(reply?.body ?? [], { status: reply?.status ?? 200 });
  };
  const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
    global: { fetch },
    auth: { storage: sessionStorageFor(STAFF), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client}>{children}</RivrDataProvider>;
  const { result } = renderHook(() => ({ ...useSeatActions(VENUE), leftOwing: useLeftOwingCallTime(VENUE) }), { wrapper });
  return { result, calls };
}

afterEach(cleanup);

describe('Left before call time', () => {
  it('lists members who left a seat owing call time, for admins', async () => {
    const { result } = renderSeats({ left_owing_call_time: { body: [{ member_id: 'm1', full_name: 'Ritika Das', table_name: 'Private Room', owed_seconds: 5400 }] } });
    await waitFor(() => expect(result.current.leftOwing.data).toEqual([{ memberId: 'm1', fullName: 'Ritika Das', tableName: 'Private Room', owed: 5400 }]));
  });
});

describe('Leaving before call time', () => {
  it('lets a member leave early with the reason', async () => {
    const { result, calls } = renderSeats({ let_leave_early: { body: 'e1' } });
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.letLeaveEarly.mutateAsync({ memberId: 'm1', reason: 'Family emergency' });
    });
    expect(outcome).toEqual({ ok: true, value: null });
    expect(calls.find((call) => call.rpc === 'let_leave_early')?.body).toEqual({ p_venue_id: VENUE, p_member_id: 'm1', p_reason: 'Family emergency' });
  });

  it('names why seating did not go through, and closing or linking a table in their own words', async () => {
    const { result } = renderSeats({
      seat_member: { status: 400, body: { code: 'RVSTD', message: 'seated' } },
      set_table_open: { status: 400, body: { code: 'RVSTD', message: 'players' } },
      set_must_move: { status: 400, body: { code: '22023', message: 'feeds a main table' } },
      move_seat: { status: 400, body: { code: '22023', message: 'closed' } },
    });
    let outcomes: unknown[] = [];
    await act(async () => {
      outcomes = [
        await result.current.seat.mutateAsync({ tableId: 't3', seat: 4, phone: '9000000211' }),
        await result.current.setOpen.mutateAsync({ tableId: 't3', isOpen: false }),
        await result.current.setMustMove.mutateAsync({ tableId: 't5', mainTableId: 't5' }),
        await result.current.move.mutateAsync({ sessionId: 's1', tableId: 't4', seat: 1 }),
      ];
    });
    expect(outcomes).toEqual([
      { ok: false, error: 'seated' }, { ok: false, error: 'table_in_use' }, { ok: false, error: 'must_move_invalid' }, { ok: false, error: 'invalid' },
    ]);
  });

  it('says when no call time is owed', async () => {
    const { result } = renderSeats({ let_leave_early: { status: 400, body: { code: 'RVCTD', message: 'none owed' } } });
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.letLeaveEarly.mutateAsync({ memberId: 'm1', reason: 'Family emergency' });
    });
    expect(outcome).toEqual({ ok: false, error: 'call_time_done' });
  });
});
