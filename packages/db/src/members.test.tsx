import { createClient } from '@supabase/supabase-js';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import {
  isMemberQuery, useMemberActions, useMemberEarlyDepartures, useMemberRecord, useMembersOfTier, useMemberSearch, useVenueTiers, useWithdrawEarlyDeparture,
} from './members.ts';
import { RivrDataProvider } from './provider.tsx';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

const STAFF = '00000000-0000-4000-8000-000000000110';
const VENUE = '00000000-0000-4000-8000-000000000001';

/** A fake API: each RPC answers with its reply (a table read under ''); every call is kept with what it was sent. */
function renderMembers(replies: Record<string, { status?: number; body: unknown }>) {
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
    search: useMemberSearch(VENUE, 'Kabir'), record: useMemberRecord(VENUE, 'm1'), departures: useMemberEarlyDepartures(VENUE, 'm1'),
    tiers: useVenueTiers(VENUE), actions: useMemberActions(VENUE), everyone: useMembersOfTier(VENUE, null), ofTier: useMembersOfTier(VENUE, 't2'),
    withdraw: useWithdrawEarlyDeparture(VENUE, 'm1'),
  }), { wrapper });
  return { result, calls };
}

afterEach(cleanup);

describe('Members', () => {
  it('searches by a member number of any length, or two characters of a name or mobile', () => {
    expect(isMemberQuery('7')).toBe(true);
    expect(isMemberQuery(' K ')).toBe(false);
    expect(isMemberQuery('Ka')).toBe(true);
  });

  it('gives found members, a record with its qualifying stake, early departures and the venue\'s tiers', async () => {
    const { result } = renderMembers({
      member_search: { body: [{ member_id: 'm1', member_number: 2, full_name: 'Kabir Sethi', phone: '+919000000202', tier_name: 'Member', visits: 3, last_visit_at: null }] },
      member_record: { body: [{
        member_id: 'm1', member_number: 2, full_name: 'Kabir Sethi', phone: '+919000000202', tier_id: 't2', tier_name: "Founders' Circle", tier_until: '2026-11-22',
        qualifying_small_blind: 10000, qualifying_big_blind: 20000, is_kyc_complete: true, photo_path: null, visits: 3, last_visit_at: null, is_in_room: false,
        early_departures: 1, known_as: 'Kabir',
      }] },
      member_early_departures: { body: [
        { early_departure_id: 'e1', created_at: '2026-11-15T20:00:00Z', shortfall_seconds: 3600, reason: 'Unwell', staff_name: 'Harish Kumar',
          withdrawn_at: null, withdrawn_reason: null, withdrawn_by: null },
        { early_departure_id: 'e0', created_at: '2026-11-08T20:00:00Z', shortfall_seconds: 600, reason: 'Unwell', staff_name: 'Harish Kumar',
          withdrawn_at: '2026-11-09T10:00:00Z', withdrawn_reason: 'Recorded against the wrong member', withdrawn_by: 'Vikram Rao' },
      ] },
      '': { body: [{ id: 't3', name: 'Black card' }, { id: 't2', name: "Founders' Circle" }] },
    });
    await waitFor(() => expect(result.current.search.data?.[0]).toMatchObject({ memberNumber: 2, fullName: 'Kabir Sethi', visits: 3, lastVisitAt: null }));
    await waitFor(() => expect(result.current.record.data).toMatchObject({ knownAs: 'Kabir', tierUntil: '2026-11-22', qualifying: { smallBlind: 10000n, bigBlind: 20000n }, earlyDepartures: 1 }));
    await waitFor(() => expect(result.current.departures.data).toEqual([
      { earlyDepartureId: 'e1', at: '2026-11-15T20:00:00Z', shortfallSeconds: 3600, reason: 'Unwell', staffName: 'Harish Kumar', withdrawn: null },
      { earlyDepartureId: 'e0', at: '2026-11-08T20:00:00Z', shortfallSeconds: 600, reason: 'Unwell', staffName: 'Harish Kumar',
        withdrawn: { at: '2026-11-09T10:00:00Z', reason: 'Recorded against the wrong member', staffName: 'Vikram Rao' } },
    ]));
    await waitFor(() => expect(result.current.tiers.data).toEqual([{ tierId: 't3', name: 'Black card' }, { tierId: 't2', name: "Founders' Circle" }]));
  });

  it('lists every member of the venue with no tier given, and a tier’s members with one', async () => {
    const { result, calls } = renderMembers({
      members_of_tier: { body: [{ member_id: 'm1', member_number: 2, full_name: 'Kabir Sethi', phone: null, tier_name: 'Member', visits: 0, last_visit_at: null }] },
    });
    await waitFor(() => expect(result.current.everyone.data?.[0]).toMatchObject({ memberId: 'm1', fullName: 'Kabir Sethi', phone: null }));
    await waitFor(() => expect(result.current.ofTier.isSuccess).toBe(true));
    expect(calls.filter((call) => call.rpc === 'members_of_tier').map((call) => call.body)).toEqual(expect.arrayContaining([
      { p_venue_id: VENUE }, { p_venue_id: VENUE, p_tier_id: 't2' },
    ]));
  });

  it('withdraws an early departure with its reason, and says why one is refused', async () => {
    const { result, calls } = renderMembers({ withdraw_early_departure: { status: 403, body: { code: '42501', message: 'no' } } });
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.withdraw.mutateAsync({ earlyDepartureId: 'e1', reason: ' Recorded against the wrong member ' });
    });
    expect(outcome).toEqual({ ok: false, error: 'not_allowed' });
    expect(calls.find((call) => call.rpc === 'withdraw_early_departure')?.body).toEqual({ p_early_departure_id: 'e1', p_reason: 'Recorded against the wrong member' });
  });

  it('has no record for a member not of this venue', async () => {
    const { result } = renderMembers({ member_record: { body: [] } });
    await waitFor(() => expect(result.current.record.data).toBeNull());
  });

  it('changes a tier with its reason and last day, and says why one is refused', async () => {
    const { result, calls } = renderMembers({ set_member_tier: { status: 400, body: { code: '22023', message: 'bad' } } });
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.actions.setTier.mutateAsync({ memberId: 'm1', tierId: 't2', reason: 'Weekend guest', until: '2026-11-22' });
    });
    expect(outcome).toEqual({ ok: false, error: 'invalid' });
    expect(calls.find((call) => call.rpc === 'set_member_tier')?.body).toEqual({
      p_venue_id: VENUE, p_member_id: 'm1', p_tier_id: 't2', p_reason: 'Weekend guest', p_until: '2026-11-22',
    });
  });

  it('sets a break with its days and reason, giving when it ends (A5-14)', async () => {
    const { result, calls } = renderMembers({ set_member_break: { status: 200, body: '2026-12-01T18:30:00+00:00' } });
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.actions.setBreak.mutateAsync({ memberId: 'm1', days: 30, reason: 'Asked at the desk' });
    });
    expect(outcome).toEqual({ ok: true, value: '2026-12-01T18:30:00+00:00' });
    expect(calls.find((call) => call.rpc === 'set_member_break')?.body).toEqual({ p_member_id: 'm1', p_days: 30, p_reason: 'Asked at the desk' });
  });
});
