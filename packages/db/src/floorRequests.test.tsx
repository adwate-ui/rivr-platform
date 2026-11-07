import { createClient, type RealtimeChannel } from '@supabase/supabase-js';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { useFloorActions, useFloorUndo } from './floorActions.ts';
import { useFloorRequests, useFloorRequestTargets, useFloorSignals } from './floorRequests.ts';
import { RivrDataProvider } from './provider.tsx';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

const STAFF = '00000000-0000-4000-8000-000000000103';
const VENUE = '00000000-0000-4000-8000-000000000001';

type Replies = Record<string, { status?: number; body: unknown }>;

/** A fake API: each RPC answers with its reply; every call is kept with what it was sent. */
function fakeClient(replies: Replies) {
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
  return { client, calls };
}

function renderFloor(replies: Replies) {
  const { client, calls } = fakeClient(replies);
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client}>{children}</RivrDataProvider>;
  const { result } = renderHook(() => ({
    requests: useFloorRequests(VENUE), targets: useFloorRequestTargets(VENUE), actions: useFloorActions(VENUE), undo: useFloorUndo(VENUE),
  }), { wrapper });
  return { result, calls };
}

const row = (kind: string, extra: Record<string, unknown> = {}) => ({
  kind, request_id: `${kind}-1`, session_id: 's1', member_id: 'm1', full_name: 'Vidya Chadha', table_id: 't2', seat: 5,
  since: '2026-11-15T16:00:00Z', minutes: null, call_time_left: 3600, top_up: null, owed_seconds: null, ...extra,
});

afterEach(cleanup);

describe('the floor\'s requests', () => {
  it('reads every kind with what the floor acts on, and drops one it does not know', async () => {
    const { result } = renderFloor({
      floor_requests: { body: [
        row('join', { session_id: null, seat: null, call_time_left: null }), row('top_up', { top_up: 'in_progress' }), row('time', { minutes: 60 }),
        row('leaving'), row('left_owing', { call_time_left: null, owed_seconds: 1800 }), row('cab'),
      ] },
    });
    await waitFor(() => expect(result.current.requests.data).toHaveLength(5));
    expect(result.current.requests.data?.map((request) => request.kind)).toEqual(['join', 'top_up', 'time', 'leaving', 'left_owing']);
    expect(result.current.requests.data?.[0]).toEqual({ kind: 'join', id: 'join-1', memberId: 'm1', fullName: 'Vidya Chadha', tableId: 't2', since: '2026-11-15T16:00:00Z' });
    expect(result.current.requests.data?.[1]).toMatchObject({ kind: 'top_up', id: 'top_up-1', sessionId: 's1', seat: 5, isStarted: true, callTimeLeft: 3600 });
    expect(result.current.requests.data?.[2]).toMatchObject({ kind: 'time', minutes: 60 });
    expect(result.current.requests.data?.[4]).toMatchObject({ kind: 'left_owing', owedSeconds: 1800 });
  });

  it('gives the club\'s targets, null where it set none', async () => {
    const { result } = renderFloor({ floor_request_targets: { body: [{ top_up_seconds: 180, other_seconds: null }] } });
    await waitFor(() => expect(result.current.targets.data).toEqual({ topUpSeconds: 180, otherSeconds: null }));
  });
});

describe('the floor\'s seating', () => {
  it('seats by number and gives the new seat\'s session', async () => {
    const { result, calls } = renderFloor({ seat_member: { body: 's9' } });
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.actions.seat.mutateAsync({ tableId: 't2', seat: 5, who: { memberNumber: 42 }, callMinutes: 240 });
    });
    expect(outcome).toEqual({ ok: true, value: 's9' });
    expect(calls.find((call) => call.rpc === 'seat_member')?.body).toEqual({ p_table_id: 't2', p_seat: 5, p_member_number: 42, p_call_minutes: 240 });
  });

  it('seats the next on a list and finds their seat for Undo', async () => {
    const { result, calls } = renderFloor({ assign_from_waitlist: { body: null }, floor_seats: { body: [{ session_id: 's7', member_id: 'm7' }] } });
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.actions.seatFromList.mutateAsync({ entryId: 'e1', memberId: 'm7', tableId: 't2', seat: 3, callMinutes: 180 });
    });
    expect(outcome).toEqual({ ok: true, value: 's7' });
    expect(calls.find((call) => call.rpc === 'assign_from_waitlist')?.body).toEqual({ p_entry_id: 'e1', p_table_id: 't2', p_seat: 3, p_call_minutes: 180 });
  });

  it('redeems bonus chips with the buy-in as it seats (decision 0504), and sends none for 0', async () => {
    const { result, calls } = renderFloor({ seat_member: { body: 's9' }, assign_from_waitlist: { body: null }, floor_seats: { body: [] } });
    await act(async () => {
      await result.current.actions.seat.mutateAsync({ tableId: 't2', seat: 5, who: { memberNumber: 42 }, callMinutes: 240, bonusChips: 1000 });
      await result.current.actions.seatFromList.mutateAsync({ entryId: 'e1', memberId: 'm7', tableId: 't2', seat: 3, callMinutes: 180, bonusChips: 0 });
    });
    expect(calls.find((call) => call.rpc === 'seat_member')?.body).toEqual({
      p_table_id: 't2', p_seat: 5, p_member_number: 42, p_call_minutes: 240, p_bonus_chips: 1000,
    });
    expect(calls.find((call) => call.rpc === 'assign_from_waitlist')?.body).toEqual({ p_entry_id: 'e1', p_table_id: 't2', p_seat: 3, p_call_minutes: 180 });
  });

  it('names why bonus chips were not redeemed: more than the member has, not 50s, own record, promotions off, too many', async () => {
    let outcomes: unknown[] = [];
    for (const code of ['RVBON', 'RVCHP', 'RVOWN', 'RVKIL', 'RVRAT']) {
      const { result } = renderFloor({ seat_member: { status: 400, body: { code, message: 'refused' } } });
      await act(async () => {
        outcomes = [...outcomes, await result.current.actions.seat.mutateAsync({ tableId: 't2', seat: 5, who: { memberNumber: 42 }, callMinutes: 240, bonusChips: 50 })];
      });
      cleanup();
    }
    expect(outcomes).toEqual(['bonus_short', 'not_chips', 'own_record', 'bonus_off', 'too_many'].map((error) => ({ ok: false, error })));
  });

  it('names why a seating or a move did not go through', async () => {
    const { result } = renderFloor({
      assign_from_waitlist: { status: 400, body: { code: 'RVOCC', message: 'taken' } },
      move_seat: { status: 400, body: { code: 'RVHLD', message: 'held' } },
    });
    let outcomes: unknown[] = [];
    await act(async () => {
      outcomes = [
        await result.current.actions.seatFromList.mutateAsync({ entryId: 'e1', memberId: 'm7', tableId: 't2', seat: 3, callMinutes: 180 }),
        await result.current.actions.move.mutateAsync({ sessionId: 's1', tableId: 't3', seat: 2 }),
        await result.current.actions.declineJoin.mutateAsync('e1'),
      ];
    });
    expect(outcomes).toEqual([{ ok: false, error: 'occupied' }, { ok: false, error: 'held' }, { ok: true, value: null }]);
  });
});

describe('Undo on the floor', () => {
  it('calls each change\'s compensating function', async () => {
    const { result, calls } = renderFloor({});
    await act(async () => {
      await result.current.undo.mutateAsync({ kind: 'seat', sessionId: 's1' });
      await result.current.undo.mutateAsync({ kind: 'leave', sessionId: 's2' });
      await result.current.undo.mutateAsync({ kind: 'callTime', requestId: 'r1' });
      await result.current.undo.mutateAsync({ kind: 'topUp', requestId: 'r2' });
      await result.current.undo.mutateAsync({ kind: 'join', entryId: 'e1' });
    });
    expect(calls.filter((call) => call.rpc.startsWith('undo_')).map((call) => [call.rpc, call.body])).toEqual([
      ['undo_seat', { p_session_id: 's1' }], ['undo_leave', { p_session_id: 's2' }], ['undo_call_time', { p_request_id: 'r1' }],
      ['undo_top_up', { p_request_id: 'r2' }], ['undo_waitlist_decision', { p_entry_id: 'e1' }],
    ]);
  });

  it('says when a change moved on and cannot be undone', async () => {
    const { result } = renderFloor({ undo_leave: { status: 400, body: { code: 'RVOCC', message: 'taken' } } });
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.undo.mutateAsync({ kind: 'leave', sessionId: 's2' });
    });
    expect(outcome).toEqual({ ok: false, error: 'occupied' });
  });
});

describe('the floor live', () => {
  it('listens on the floor topic of the venue and reads the floor again a second after a burst', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { client, calls } = fakeClient({ floor_requests: { body: [] } });
    const channels: RealtimeChannel[] = [];
    const openChannel = client.channel.bind(client);
    vi.spyOn(client, 'channel').mockImplementation((name, options) => {
      const channel = openChannel(name, options);
      vi.spyOn(channel, 'on');
      // No socket in tests: subscribing does nothing, and the test fires the signal itself.
      vi.spyOn(channel, 'subscribe').mockReturnValue(channel);
      channels.push(channel);
      return channel;
    });
    const close = vi.spyOn(client, 'removeChannel').mockResolvedValue('ok');
    const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client}>{children}</RivrDataProvider>;
    const { unmount } = renderHook(() => { useFloorSignals(VENUE); return useFloorRequests(VENUE); }, { wrapper });
    await waitFor(() => expect(channels.map((channel) => channel.topic)).toContain(`realtime:floor:${VENUE}`));
    await waitFor(() => expect(calls.filter((call) => call.rpc === 'floor_requests')).toHaveLength(1));
    const floor = channels.find((channel) => channel.topic === `realtime:floor:${VENUE}`);
    const signal = vi.mocked(floor?.on)?.mock.calls.find(([type]) => String(type) === 'broadcast')?.[2];
    if (signal === undefined) throw new Error('No handler for the signal of the floor');
    act(() => { signal({ type: 'broadcast', event: 'changed', payload: {} }); signal({ type: 'broadcast', event: 'changed', payload: {} }); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1_100); });
    await waitFor(() => expect(calls.filter((call) => call.rpc === 'floor_requests')).toHaveLength(2));
    unmount();
    expect(close).toHaveBeenCalled();
    vi.useRealTimers();
  });
});
