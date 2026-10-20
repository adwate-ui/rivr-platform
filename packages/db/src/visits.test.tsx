import { createClient } from '@supabase/supabase-js';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { RivrDataProvider } from './provider.tsx';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';
import { useCheckInActions, useCheckOutActions, useDoorBoard } from './visits.ts';

const STAFF = '00000000-0000-4000-8000-000000000124';
const VENUE = '00000000-0000-4000-8000-000000000001';

/** A fake API: each RPC answers with its reply; every call is kept with what it was sent. */
function renderDoor(replies: Record<string, { status?: number; body: unknown }>) {
  const calls: { rpc: string; body: unknown }[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const rpc = (input instanceof Request ? input.url : String(input)).split('/rpc/')[1] ?? '';
    calls.push({ rpc, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const reply = replies[rpc];
    return Response.json(reply?.body ?? null, { status: reply?.status ?? 200 });
  };
  const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
    global: { fetch },
    auth: { storage: sessionStorageFor(STAFF), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client}>{children}</RivrDataProvider>;
  const { result } = renderHook(() => ({ board: useDoorBoard(VENUE), actions: useCheckInActions(VENUE), out: useCheckOutActions(VENUE) }), { wrapper });
  return { result, calls };
}

afterEach(cleanup);

describe('The door', () => {
  it('gives who is expected and who is in the room', async () => {
    const { result } = renderDoor({ door_board: { body: [
      { member_id: 'm1', full_name: 'Naina Kapoor', tier_name: 'Member', is_in_room: false, since: '2026-10-19T18:00:00+00:00' },
      { member_id: 'm2', full_name: 'Kabir Sethi', tier_name: 'Member', is_in_room: true, since: '2026-10-19T18:10:00+00:00' },
    ] } });
    await waitFor(() => expect(result.current.board.data).toEqual([
      { memberId: 'm1', fullName: 'Naina Kapoor', tierName: 'Member', isInRoom: false, since: '2026-10-19T18:00:00+00:00' },
      { memberId: 'm2', fullName: 'Kabir Sethi', tierName: 'Member', isInRoom: true, since: '2026-10-19T18:10:00+00:00' },
    ]));
  });

  it('checks a member in by mobile number, and says why when the member is on a break', async () => {
    const { result, calls } = renderDoor({ door_board: { body: [] }, check_in_by_phone: { status: 400, body: { code: 'RVBRK', message: 'on a break' } } });
    let outcome: unknown;
    await act(async () => { outcome = await result.current.actions.checkInByPhone.mutateAsync('9000000213'); });
    expect(outcome).toEqual({ ok: false, error: 'on_break' });
    expect(calls.find((call) => call.rpc === 'check_in_by_phone')?.body).toEqual({ p_venue_id: VENUE, p_phone: '9000000213' });
  });

  it('checks a member out by mobile number, resolving to the closed visit', async () => {
    const { result, calls } = renderDoor({ door_board: { body: [] }, check_out_by_phone: { body: 'v1' } });
    let outcome: unknown;
    await act(async () => { outcome = await result.current.out.checkOutByPhone.mutateAsync('9000000213'); });
    expect(outcome).toEqual({ ok: true, value: 'v1' });
    expect(calls.find((call) => call.rpc === 'check_out_by_phone')?.body).toEqual({ p_venue_id: VENUE, p_phone: '9000000213' });
  });

  it('says how much call time a member still owes when the door refuses them', async () => {
    const { result } = renderDoor({ door_board: { body: [] },
      check_out: { status: 400, body: { code: 'RVCTS', message: 'Call time not complete', details: '3540', hint: null } } });
    let outcome: unknown;
    await act(async () => { outcome = await result.current.out.checkOut.mutateAsync('m1'); });
    expect(outcome).toEqual({ ok: false, error: { reason: 'call_time_owed', owedSeconds: 3540 } });
  });

  it('says a member still seated is sent to the floor or the cage first', async () => {
    const { result } = renderDoor({ door_board: { body: [] }, check_out: { status: 400, body: { code: 'RVSTD', message: 'Still seated', details: null } } });
    let outcome: unknown;
    await act(async () => { outcome = await result.current.out.checkOut.mutateAsync('m1'); });
    expect(outcome).toEqual({ ok: false, error: { reason: 'seated', owedSeconds: 0 } });
  });
});
