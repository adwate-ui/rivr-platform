import { createClient } from '@supabase/supabase-js';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { useEveryMember, useMemberChoices, useMembersPage, type MembersView } from './membersList.ts';
import { RivrDataProvider } from './provider.tsx';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

const STAFF = '00000000-0000-4000-8000-000000000110';
const VENUE = '00000000-0000-4000-8000-000000000001';

const KABIR = {
  total: 4812, member_id: 'm1', member_number: 2, full_name: 'Kabir Sethi', phone: null, phone_last4: '0102', tier_name: 'Member', visits: 0, last_visit_at: null,
  kyc_status: 'at_desk', minutes_played: 135, city: 'Gurugram', member_since: '2026-10-20T10:00:00Z',
  known_as: null, own_referral_code: 'K7M2PQ9X', occupation: 'salaried', play_times: ['weekends', 'someday'], games_played: ['plo'],
  referral_code: 'FRIEND1', creator_code: null, utm_source: 'instagram', utm_medium: null, utm_campaign: 'launch', utm_content: null, utm_term: null,
  first_seen_at: null, kyc_method: 'digilocker', kyc_verified_at: '2026-10-21T15:00:00Z',
  date_of_birth: null, pan: null, masked_aadhaar: null, aadhaar_name: null, address: null, bonus_paise: 200000,
};
const ARJUN = { ...KABIR, member_id: 'm2', member_number: 3, full_name: 'Arjun Mehta', phone: '+919000000103', phone_last4: '0103', kyc_status: 'pending', city: null, occupation: 'astronaut', bonus_paise: 0 };

const VIEW: MembersView = {
  sort: { key: 'played', direction: 'descending' }, query: 'sethi', page: 3, tierId: 't2',
  filters: { kyc: { kind: 'choice', chosen: ['at_desk'] }, played: { kind: 'range', min: '2', max: '' } },
};

/** A fake API: `members_page` answers by the page asked for, `members_choices` with `choices`; every call is kept. */
function fakeApi(pages: (page: number) => readonly object[], choices: readonly object[] = []) {
  const calls: { rpc: string; view: Record<string, unknown> }[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const rpc = (input instanceof Request ? input.url : String(input)).split('/rpc/')[1] ?? '';
    const view: Record<string, unknown> = init?.body ? JSON.parse(String(init.body)).p_view : {};
    calls.push({ rpc, view });
    return Response.json(rpc === 'members_choices' ? choices : pages(Number(view['page'])));
  };
  const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
    global: { fetch },
    auth: { storage: sessionStorageFor(STAFF), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client}>{children}</RivrDataProvider>;
  return { calls, wrapper };
}

afterEach(cleanup);

describe('the Members list on the server (redesign RD-29)', () => {
  it('asks for one page of the view, fifty to a page, and reads each member with their Bonus and how many there are', async () => {
    const { calls, wrapper } = fakeApi(() => [KABIR, ARJUN]);
    const { result } = renderHook(() => useMembersPage(VENUE, VIEW), { wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(calls).toEqual([{ rpc: 'members_page', view: {
      tier_id: 't2', query: 'sethi', sort: { key: 'played', direction: 'descending' }, scope: {}, page: 3, page_size: 50,
      filters: { kyc: { kind: 'choice', chosen: ['at_desk'] }, played: { kind: 'range', min: '2', max: '' } },
    } }]);
    expect(result.current.data?.total).toBe(4812);
    expect(result.current.data?.rows[0]).toEqual({
      memberId: 'm1', memberNumber: 2, fullName: 'Kabir Sethi', phone: null, phoneLast4: '0102', tierName: 'Member', visits: 0, lastVisitAt: null,
      kycStatus: 'at_desk', minutesPlayed: 135, city: 'Gurugram', memberSince: '2026-10-20T10:00:00Z', bonus: 200000n,
      // What an export adds (the owner, 9 Nov): the answers sign-up offers (an unknown code dropped), how they came, the check;
      // no documents for staff who are not super admins.
      details: {
        knownAs: null, ownReferralCode: 'K7M2PQ9X', occupation: 'salaried', playTimes: ['weekends'], gamesPlayed: ['plo'],
        referralCode: 'FRIEND1', creatorCode: null, campaign: { source: 'instagram', medium: null, name: 'launch', content: null, term: null },
        firstSeenAt: null, kycMethod: 'digilocker', kycVerifiedAt: '2026-10-21T15:00:00Z',
        dateOfBirth: null, pan: null, maskedAadhaar: null, aadhaarName: null, address: null,
      },
    });
    // A KYC status the console does not know reads as not done, never as verified; an answer it does not know as none.
    expect(result.current.data?.rows[1]).toMatchObject({ phone: '+919000000103', kycStatus: 'not_done', city: null, bonus: 0n });
    expect(result.current.data?.rows[1]?.details.occupation).toBeNull();
  });

  it('asks nothing until the table has handed its view over, and reads a view that leaves nobody as none', async () => {
    const { calls, wrapper } = fakeApi(() => []);
    const waiting = renderHook(() => useMembersPage(VENUE, null), { wrapper });
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(calls).toEqual([]);
    expect(waiting.result.current.data).toBeUndefined();
    const { result } = renderHook(() => useMembersPage(VENUE, { ...VIEW, tierId: null, sort: null }), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual({ rows: [], total: 0 }));
    expect(calls[0]?.view).toMatchObject({ tier_id: '', sort: null });
  });

  it('reads a column menu\'s counts over every member the view leaves, whatever its page and order', async () => {
    const { calls, wrapper } = fakeApi(() => [], [
      { column_key: 'kyc', value: 'verified', members: 4500 }, { column_key: 'kyc', value: 'at_desk', members: 12 },
      { column_key: 'city', value: 'Gurugram', members: 3100 }, { column_key: 'tonight', value: 'seated', members: 30 },
    ]);
    const { result } = renderHook(() => useMemberChoices(VENUE, VIEW), { wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toEqual({
      status: [], kyc: [{ value: 'verified', count: 4500 }, { value: 'at_desk', count: 12 }], city: [{ value: 'Gurugram', count: 3100 }], tonight: [{ value: 'seated', count: 30 }],
    });
    expect(calls).toEqual([{ rpc: 'members_choices', view: expect.objectContaining({ tier_id: 't2', query: 'sethi', sort: null, page: 1 }) }]);
  });

  it('reads every member a view leaves for an export, a thousand at a time, until the total is reached', async () => {
    const page = (count: number) => Array.from({ length: count }, (_, at) => ({ ...KABIR, total: 2300, member_id: `m${String(at)}` }));
    const { calls, wrapper } = fakeApi((asked) => (asked <= 2 ? page(1000) : page(300)));
    const { result } = renderHook(() => useEveryMember(VENUE), { wrapper });
    const rows = await result.current(VIEW);
    expect(rows).toHaveLength(2300);
    expect(calls.map((call) => [call.view['page'], call.view['page_size']])).toEqual([[1, 1000], [2, 1000], [3, 1000]]);
    // The view's own narrowing goes with every page.
    expect(calls.every((call) => call.view['query'] === 'sethi' && call.view['tier_id'] === 't2')).toBe(true);
  });
});
