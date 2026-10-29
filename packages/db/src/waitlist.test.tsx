import { createClient } from '@supabase/supabase-js';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { RivrDataProvider } from './provider.tsx';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';
import { useApproveWaitlistRequest, useFloorTables, useFloorWaitlistActions, useMyWaitlist, useWaitlistActions, useWaitlistBoard, useWaitlistRequests } from './waitlist.ts';

const ISHAAN = '00000000-0000-4000-8000-000000000211';
const VENUE = '00000000-0000-4000-8000-000000000001';

/** A fake API: each path answers with its reply. */
function renderWaitlist(replies: Record<string, { status?: number; body: unknown }>) {
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
    auth: { storage: sessionStorageFor(ISHAAN), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client}>{children}</RivrDataProvider>;
  const { result } = renderHook(
    () => ({
      tables: useFloorTables(), places: useMyWaitlist(), board: useWaitlistBoard(VENUE),
      member: useWaitlistActions(), floor: useFloorWaitlistActions(VENUE), requests: useWaitlistRequests(VENUE), approve: useApproveWaitlistRequest(),
    }),
    { wrapper },
  );
  return { result, calls };
}

const EMPTY = {
  '/rest/v1/game_table': { body: [] },
  '/rest/v1/table_type': { body: [] },
  '/rpc/waitlist_lengths': { body: [] },
  '/rpc/floor_open_seats': { body: [] },
  '/rpc/my_waitlist': { body: [] },
  '/rpc/waitlist_board': { body: [] },
  '/rpc/waitlist_requests': { body: [] },
};

afterEach(cleanup);

describe('Waitlist data', () => {
  it('gives tonight\'s tables with how many wait for each game and each table\'s open seats, money in paise as bigint', async () => {
    const { result } = renderWaitlist({
      ...EMPTY,
      '/rest/v1/game_table': {
        body: [
          { id: 't2', venue_id: VENUE, name: 'Table 2', is_open: true, seats: 9, position: 2, table_type_id: 'hi' },
          { id: 'tx', venue_id: VENUE, name: 'Table 9', is_open: true, seats: 9, position: 9, table_type_id: 'gone' },
        ],
      },
      '/rest/v1/table_type': {
        body: [{ id: 'hi', name: 'NLH 100/200', small_blind_paise: 10000, big_blind_paise: 20000, buy_in_min_paise: 1000000, straddle_paise: null }],
      },
      '/rpc/waitlist_lengths': { body: [{ table_type_id: 'hi', waiting: 3, call_time_minutes: 180 }] },
      '/rpc/floor_open_seats': { body: [{ table_id: 't2', open_seats: 4 }] },
    });
    // A table whose game the person cannot read is left out.
    await waitFor(() => expect(result.current.tables.data).toEqual([{
      id: 't2', venueId: VENUE, name: 'Table 2', isOpen: true, seats: 9, tableTypeId: 'hi', tableTypeName: 'NLH 100/200',
      smallBlind: 10000n, bigBlind: 20000n, buyIn: 1000000n, straddle: null, waiting: 3, openSeats: 4, mustMoveToTableId: null, room: 'main',
      callTimeMinutes: 180,
    }]));
  });

  it('gives the member\'s places and the floor\'s board in order', async () => {
    const { result } = renderWaitlist({
      ...EMPTY,
      '/rpc/my_waitlist': {
        body: [{
          entry_id: 'e4', table_type_id: 'hi', table_type_name: 'NLH 100/200', small_blind_paise: 10000, big_blind_paise: 20000,
          joined_at: '2026-10-19T14:00:00+00:00', place: 4, is_request: false,
        }, {
          entry_id: 'e5', table_type_id: 'lo', table_type_name: 'NLH 50/100', small_blind_paise: 5000, big_blind_paise: 10000,
          joined_at: '2026-10-19T14:05:00+00:00', place: 0, is_request: true,
        }],
      },
      '/rpc/waitlist_board': {
        body: [{
          entry_id: 'e4', table_type_id: 'hi', member_id: ISHAAN, full_name: 'Ishaan Verma', joined_at: '2026-10-19T14:00:00+00:00',
          place: 4, added_by_floor: true, priority_reason: 'Black card',
        }],
      },
    });
    await waitFor(() => expect(result.current.places.data).toEqual([{
      entryId: 'e4', tableTypeId: 'hi', tableTypeName: 'NLH 100/200', smallBlind: 10000n, bigBlind: 20000n,
      joinedAt: '2026-10-19T14:00:00+00:00', place: 4, isRequest: false,
    }, {
      entryId: 'e5', tableTypeId: 'lo', tableTypeName: 'NLH 50/100', smallBlind: 5000n, bigBlind: 10000n,
      joinedAt: '2026-10-19T14:05:00+00:00', place: null, isRequest: true,
    }]));
    await waitFor(() => expect(result.current.board.data).toEqual([{
      entryId: 'e4', tableTypeId: 'hi', memberId: ISHAAN, fullName: 'Ishaan Verma', joinedAt: '2026-10-19T14:00:00+00:00',
      place: 4, addedByFloor: true, priorityReason: 'Black card',
    }]));
  });

  it('lists the joins waiting for the floor, approves one, and says why a join or an approval was refused', async () => {
    const { result } = renderWaitlist({
      ...EMPTY,
      '/rpc/waitlist_requests': {
        body: [{ entry_id: 'e6', table_type_id: 'hi', member_id: ISHAAN, full_name: 'Ishaan Verma', joined_at: '2026-10-29T14:00:00+00:00' }],
      },
      '/rpc/approve_waitlist_request': { status: 400, body: { code: '22023', message: 'No request to approve' } },
      '/rpc/join_waitlist': { status: 400, body: { code: 'RVONE', message: 'One game at a time' } },
    });
    await waitFor(() => expect(result.current.requests.data).toEqual([{
      entryId: 'e6', tableTypeId: 'hi', memberId: ISHAAN, fullName: 'Ishaan Verma', joinedAt: '2026-10-29T14:00:00+00:00',
    }]));
    expect(await act(() => result.current.approve.mutateAsync('e6'))).toEqual({ ok: false, error: 'invalid' });
    expect(await act(() => result.current.member.join.mutateAsync({ tableTypeId: 'hi', requestId: 'r2' }))).toEqual({
      ok: false, error: 'one_at_a_time',
    });
  });

  it('joins with the tap\'s request id and leaves, saying why when the database refuses', async () => {
    const { result, calls } = renderWaitlist({
      ...EMPTY,
      '/rpc/join_waitlist': { status: 400, body: { code: 'RVKYC', message: 'Finish the identity check to join a waitlist' } },
      '/rpc/leave_waitlist': { body: null },
    });
    expect(await act(() => result.current.member.join.mutateAsync({ tableTypeId: 'hi', requestId: 'r1' }))).toEqual({
      ok: false, error: 'kyc_needed',
    });
    expect(calls.find((call) => call.url.includes('/rpc/join_waitlist'))?.body).toEqual({ p_table_type_id: 'hi', p_idempotency_key: 'r1' });
    expect(await act(() => result.current.member.leave.mutateAsync('e4'))).toEqual({ ok: true, value: null });
  });

  it('lets the floor add a member by number and remove a place', async () => {
    const { result, calls } = renderWaitlist({
      ...EMPTY,
      '/rpc/add_to_waitlist': { status: 400, body: { code: 'RVNOM', message: 'No member has that number' } },
      '/rpc/leave_waitlist': { status: 400, body: { code: 'XX000', message: 'boom' } },
    });
    expect(await act(() => result.current.floor.add.mutateAsync({ tableTypeId: 'lo', phone: '9000000299', requestId: 'r2' }))).toEqual({
      ok: false, error: 'no_member',
    });
    expect(calls.find((call) => call.url.includes('/rpc/add_to_waitlist'))?.body).toEqual({
      p_table_type_id: 'lo', p_phone: '9000000299', p_idempotency_key: 'r2',
    });
    expect(await act(() => result.current.floor.remove.mutateAsync('e4'))).toEqual({ ok: false, error: 'unavailable' });
  });
});
