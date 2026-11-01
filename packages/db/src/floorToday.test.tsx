import { createClient } from '@supabase/supabase-js';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { useServeFnbOrder } from './fnb.ts';
import { useTodaysPlayers, useTopUpsTonight } from './floorToday.ts';
import { RivrDataProvider } from './provider.tsx';
import { useSetSeatCallTime } from './seats.ts';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

const STAFF = '00000000-0000-4000-8000-000000000103';
const VENUE = '00000000-0000-4000-8000-000000000001';

/** A fake API: each RPC answers with its reply; every call is kept with what it was sent. */
function renderFloor(replies: Record<string, { status?: number; body: unknown }>) {
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
  const { result } = renderHook(() => ({
    topUps: useTopUpsTonight(VENUE), players: useTodaysPlayers(VENUE), serve: useServeFnbOrder(VENUE), callTime: useSetSeatCallTime(VENUE),
  }), { wrapper });
  return { result, calls };
}

afterEach(cleanup);

describe('the floor today', () => {
  it('reads tonight\'s top-ups, an unknown status as requested', async () => {
    const { result } = renderFloor({
      top_ups_tonight: {
        body: [
          { request_id: 'r1', table_name: 'Table 3', seat: 2, full_name: 'Ishaan Verma', status: 'fulfilled', requested_at: '2026-11-01T15:00:00Z', fulfilled_seconds: 240 },
          { request_id: 'r2', table_name: 'Table 2', seat: 4, full_name: 'Vihaan Kapoor', status: 'odd', requested_at: '2026-11-01T15:05:00Z', fulfilled_seconds: null },
        ],
      },
    });
    await waitFor(() => expect(result.current.topUps.data).toEqual([
      { requestId: 'r1', tableName: 'Table 3', seat: 2, fullName: 'Ishaan Verma', status: 'fulfilled', requestedAt: '2026-11-01T15:00:00Z', fulfilledSeconds: 240 },
      { requestId: 'r2', tableName: 'Table 2', seat: 4, fullName: 'Vihaan Kapoor', status: 'requested', requestedAt: '2026-11-01T15:05:00Z', fulfilledSeconds: null },
    ]));
  });

  it('reads today\'s players with their tables, leaving out a table it cannot read', async () => {
    const { result } = renderFloor({
      todays_players: {
        body: [{
          member_id: 'm1', full_name: 'Ishaan Verma', member_number: 1211, status: 'playing', checked_in_at: '2026-11-01T13:30:00Z', checked_out_at: null,
          waiting_seconds: 600, tables: [{ table: 'Table 3', seconds: 3600 }, { table: 7 }],
        }, {
          member_id: 'm2', full_name: 'Mihir Shah', member_number: 1213, status: 'gone', checked_in_at: null, checked_out_at: null,
          waiting_seconds: 0, tables: null,
        }],
      },
    });
    await waitFor(() => expect(result.current.players.data).toEqual([
      { memberId: 'm1', fullName: 'Ishaan Verma', memberNumber: 1211, status: 'playing', checkedInAt: '2026-11-01T13:30:00Z', checkedOutAt: null,
        waitingSeconds: 600, tables: [{ table: 'Table 3', seconds: 3600 }] },
      { memberId: 'm2', fullName: 'Mihir Shah', memberNumber: 1213, status: 'left', checkedInAt: null, checkedOutAt: null, waitingSeconds: 0, tables: [] },
    ]));
  });

  it('accepts and delivers an order, and changes a player\'s call time, each a Result', async () => {
    const { result, calls } = renderFloor({
      accept_fnb_order: { body: null },
      deliver_fnb_order: { status: 400, body: { code: '22023', message: 'delivered already' } },
      set_seat_call_time: { body: null },
    });
    let outcomes: unknown[] = [];
    await act(async () => {
      outcomes = [await result.current.serve.accept.mutateAsync('o1'), await result.current.serve.deliver.mutateAsync('o1'),
        await result.current.callTime.mutateAsync({ sessionId: 's1', minutes: 240 })];
    });
    // Delivered already by another steward: taken, not an order that does not fit.
    expect(outcomes).toEqual([{ ok: true, value: null }, { ok: false, error: 'taken' }, { ok: true, value: null }]);
    expect(calls.find((call) => call.rpc === 'set_seat_call_time')?.body).toEqual({ p_session_id: 's1', p_minutes: 240 });
  });
});
