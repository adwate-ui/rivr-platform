import { createClient } from '@supabase/supabase-js';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { isMemberQuery, useMemberActions, useMemberEarlyDepartures, useMemberRecord, useMemberSearch, useVenueTiers } from './members.ts';
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
    tiers: useVenueTiers(VENUE), actions: useMemberActions(VENUE),
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
        early_departures: 1,
      }] },
      member_early_departures: { body: [{ early_departure_id: 'e1', created_at: '2026-11-15T20:00:00Z', shortfall_seconds: 3600, reason: 'Unwell', staff_name: 'Harish Kumar' }] },
      '': { body: [{ id: 't3', name: 'Black card' }, { id: 't2', name: "Founders' Circle" }] },
    });
    await waitFor(() => expect(result.current.search.data?.[0]).toMatchObject({ memberNumber: 2, fullName: 'Kabir Sethi', visits: 3, lastVisitAt: null }));
    await waitFor(() => expect(result.current.record.data).toMatchObject({ tierUntil: '2026-11-22', qualifying: { smallBlind: 10000n, bigBlind: 20000n }, earlyDepartures: 1 }));
    await waitFor(() => expect(result.current.departures.data).toEqual([{ earlyDepartureId: 'e1', at: '2026-11-15T20:00:00Z', shortfallSeconds: 3600, reason: 'Unwell', staffName: 'Harish Kumar' }]));
    await waitFor(() => expect(result.current.tiers.data).toEqual([{ tierId: 't3', name: 'Black card' }, { tierId: 't2', name: "Founders' Circle" }]));
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
});
