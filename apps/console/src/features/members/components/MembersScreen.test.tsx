import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY, StaffVenueProvider } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from '@tanstack/react-router';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MembersScreen } from './MembersScreen.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const SAKSHI = {
  member_id: 'm1', member_number: 66, full_name: 'Sakshi Tandon', phone: '+919000000266', phone_last4: '0266', tier_name: 'Black card', visits: 1,
  last_visit_at: '2026-11-03T12:00:00Z', kyc_status: 'verified', minutes_played: 135, city: 'Gurugram', member_since: '2026-10-20T10:00:00Z',
};
// As an admin reads him: no full number, only its last four digits.
const ARJUN = { ...SAKSHI, member_id: 'm2', member_number: 63, full_name: 'Arjun Mehta', visits: 7, phone: null, phone_last4: '0263', kyc_status: 'at_desk',
  minutes_played: 0, city: null };
const RECORD = {
  member_id: 'm1', member_number: 66, full_name: 'Sakshi Tandon', known_as: null, phone: '+919000000266', tier_id: 'tr1', tier_name: 'Black card',
  tier_until: null, is_kyc_complete: true, photo_path: null, qualifying_small_blind: null, qualifying_big_blind: null, visits: 1,
  last_visit_at: '2026-11-03T12:00:00Z', is_in_room: true, early_departures: 0,
};
const SEAT = { session_id: 's1', table_id: 't2', seat: 3, member_id: 'm1', full_name: 'Sakshi Tandon', tier_name: 'Black card', started_at: '2026-11-03T12:00:00Z',
  must_move_order: null, away_since: null, call_time_left: null, leaving_at: null, top_up: null, time_request_id: null, time_request_minutes: null };
const TODAY = { member_id: 'm2', full_name: 'Arjun Mehta', member_number: 63, status: 'waiting', checked_in_at: null, checked_out_at: null, waiting_seconds: 540, tables: [] };
const GRANT = { grant_id: 'g1', granted_at: '2026-11-03T13:00:00Z', club_day: '2026-11-03', promotion_name: 'Triple points', version: 2, points: 300, chips: 0, spins: 0, perk: null };
const PERK = { ...GRANT, grant_id: 'g2', promotion_name: 'Cab home', points: 0, perk: 'cab_home' };

const ANSWERS: Record<string, unknown> = {
  '/rpc/members_of_tier': [SAKSHI, ARJUN], '/rpc/member_record': [RECORD], '/rpc/floor_seats': [SEAT], '/rpc/todays_players': [TODAY],
  '/rest/v1/game_table': [{ id: 't2', venue_id: 'v1', name: 'Table 2', is_open: true, seats: 9, position: 2, table_type_id: 'tt1', must_move_to_table_id: null, room: 'main' }],
  '/rest/v1/table_type': [{ id: 'tt1', name: 'NLH 100/200', game: 'nlh', small_blind_paise: 10000, big_blind_paise: 20000, buy_in_min_paise: 1000000, straddle_paise: null }],
  '/rpc/member_promotion_grants': [GRANT, PERK],
  '/rpc/open_host_offers': [{ member_id: 'm1', offer: { kind: 'bonus', amount_paise: 200_000 } }],
  '/rpc/member_visits': [
    { visit_id: 'v1', opened_at: '2026-11-03T14:00:00Z', closed_at: '2026-11-03T20:00:00Z', tables: 'Table 1, Table 3', minutes_played: 300, call_time_met: true, left_early: false },
    { visit_id: 'v2', opened_at: '2026-11-02T14:00:00Z', closed_at: '2026-11-02T16:00:00Z', tables: 'Table 1', minutes_played: 60, call_time_met: false, left_early: true },
  ],
  '/rpc/member_points_history': [
    { line_id: 'p1', at: '2026-11-03T15:00:00Z', kind: 'earned', points: 300, reason: 'For coming back', staff_name: 'Aditya Malhotra' },
    { line_id: 'p2', at: '2026-11-02T15:00:00Z', kind: 'spent', points: 500, reason: 'RIVR cap', staff_name: null },
  ],
  // Bonus chips (decision 0504): the history before the balance, whose path it starts with.
  '/rpc/member_bonus_history': [
    { line_id: 'r1', at: '2026-11-03T14:00:00Z', kind: 'redeemed', amount_paise: 100_000, reason: null, table_name: 'Table 2', staff_name: 'Aditya Malhotra' },
    { line_id: 'b1', at: '2026-11-02T14:00:00Z', kind: 'credited', amount_paise: 250_000, reason: 'Welcome bonus', table_name: null, staff_name: null },
  ],
  '/rpc/member_bonus': [{ bonus_paise: 150_000 }],
  '/rpc/member_points_of': [{ earned: 3_250, locked: 500 }],
  '/rpc/member_sign_up': [{
    signed_up_at: '2026-10-19T10:00:00Z', city: 'Gurugram', occupation: 'salaried', play_times: ['weekday_evenings', 'weekends'],
    games_played: ['poker', 'plo'], referral_code: null, creator_code: 'ASHU', utm_source: 'instagram', utm_medium: 'social', utm_campaign: 'diwali',
    utm_content: null, utm_term: null, first_seen_at: null,
  }],
};

/** A staff member in `role` on Members, with the member `memberId`'s record open when given. */
function renderAs(role: string, memberId?: string, part?: string) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000101', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/rest/v1/staff')) {
      return Response.json([{ id: 'st1', venue_id: 'v1', full_name: 'Vikram Rao', role, venue: { name: 'RIVR Gurugram', is_practice: false } }]);
    }
    const path = Object.keys(ANSWERS).find((candidate) => url.includes(candidate));
    return Response.json(path === undefined ? [] : ANSWERS[path]);
  });
  const onNavigate = vi.fn();
  // The list keeps its search and tier in the address (owner, 9 Nov), so the screen sits in a router at /members.
  const screenRoute = createRootRoute({ component: () => <StaffVenueProvider><MembersScreen memberId={memberId} part={part} onNavigate={onNavigate} /></StaffVenueProvider> });
  const router = createRouter({ routeTree: screenRoute, history: createMemoryHistory({ initialEntries: ['/members'] }) });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <RouterProvider router={router} />
    </RivrDataProvider>,
  );
  return onNavigate;
}

describe('Members (console v3)', () => {
  it('has no funnel on Tier, which the chips above it already filter (audit F-093)', async () => {
    renderAs('super_admin');
    const table = await screen.findByRole('table', { name: 'Members' }, { timeout: 5000 });
    expect(within(table).queryByRole('button', { name: /^Tier: sort and filter/ })).toBeNull();
    expect(within(table).getByRole('button', { name: /^City: sort and filter/ })).toBeDefined();
  });

  it('lists every member on open with where each is tonight, and opens a record in the address', async () => {
    const onNavigate = renderAs('super_admin');
    const table = await screen.findByRole('table', { name: 'Members' }, { timeout: 5000 });
    expect(screen.queryByText(/^Search by/)).toBeNull();
    expect(await within(table).findByText('Table 2, seat 3')).toBeDefined();
    expect(within(table).getByText('Waiting')).toBeDefined();
    expect(screen.getByText(/^\d+ members?$/)).toBeDefined();
    for (const header of ['Name', 'No.', 'Tier', 'Tonight', 'Visits']) expect(within(table).getByRole('columnheader', { name: new RegExp(header) })).toBeDefined();
    fireEvent.click(within(table).getByRole('button', { name: 'Arjun Mehta' }));
    expect(onNavigate).toHaveBeenCalledWith('/members?member=m2');
  });

  it('shows each member\'s KYC, hours played, city and member-since day, and the mobile to a super admin (owner, 8 Nov)', async () => {
    renderAs('super_admin');
    const table = await screen.findByRole('table', { name: 'Members' }, { timeout: 5000 });
    for (const header of ['Mobile', 'ID check', 'Hours', 'City', 'Joined']) {
      expect(within(table).getByRole('columnheader', { name: new RegExp(header) })).toBeDefined();
    }
    const sakshi = within(table).getAllByRole('row').find((row) => row.textContent?.includes('Sakshi Tandon')) ?? table;
    for (const shown of ['+91 90000 00266', 'Checked', '2 h 15 min', 'Gurugram', 'Oct 2026']) expect(sakshi.textContent).toContain(shown);
    const arjun = within(table).getAllByRole('row').find((row) => row.textContent?.includes('Arjun Mehta')) ?? table;
    expect(arjun.textContent).toContain('Due');
  });

  it('keeps the mobile column from other staff, who find a member by the last four digits of their number', async () => {
    renderAs('admin');
    const table = await screen.findByRole('table', { name: 'Members' }, { timeout: 5000 });
    expect(within(table).queryByRole('columnheader', { name: /Mobile/ })).toBeNull();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Name, mobile or member number' }), { target: { value: '98100 00263' } });
    expect(within(table).getByRole('button', { name: 'Arjun Mehta' })).toBeDefined();
    expect(within(table).queryByRole('button', { name: 'Sakshi Tandon' })).toBeNull();
  });

  it('narrows the list by a name as typed or a member number, and says when nothing matches', async () => {
    renderAs('super_admin');
    const table = await screen.findByRole('table', { name: 'Members' }, { timeout: 5000 });
    const search = screen.getByRole('searchbox', { name: 'Name, mobile or member number' });
    fireEvent.change(search, { target: { value: 'sak' } });
    expect(within(table).getByRole('button', { name: 'Sakshi Tandon' })).toBeDefined();
    expect(within(table).queryByRole('button', { name: 'Arjun Mehta' })).toBeNull();
    fireEvent.change(search, { target: { value: '63' } });
    expect(within(table).getByRole('button', { name: 'Arjun Mehta' })).toBeDefined();
    expect(within(table).queryByRole('button', { name: 'Sakshi Tandon' })).toBeNull();
    fireEvent.change(search, { target: { value: 'Zoya' } });
    expect(await screen.findByText('Nothing matches Zoya.')).toBeDefined();
  });

  it('says on the record what a host offered, for the floor to give by hand (F-015)', async () => {
    renderAs('super_admin', 'm1');
    expect(await screen.findByText('Offered: 2,000 bonus chips', undefined, { timeout: 5000 })).toBeDefined();
  });

  it('lists each visit with its tables, time played, call time and whether they left early (F-017)', async () => {
    renderAs('super_admin', 'm1');
    expect(await screen.findByText('3 Nov 2026 · Table 1, Table 3', undefined, { timeout: 5000 })).toBeDefined();
    expect(screen.getByText('5 h')).toBeDefined();
    expect(screen.getByText('Call time met')).toBeDefined();
    expect(screen.getByText('Call time not met · Left early')).toBeDefined();
  });

  it('lists points with what they were for and who gave them, beside the bonus chips (F-017)', async () => {
    renderAs('super_admin', 'm1', 'bonus');
    expect(await screen.findByText('3 Nov 2026 · For coming back · Aditya Malhotra', undefined, { timeout: 5000 })).toBeDefined();
    expect(screen.getByText('+300')).toBeDefined();
    expect(screen.getByText('2 Nov 2026 · RIVR cap')).toBeDefined();
    expect(screen.getByText('−500')).toBeDefined();
  });

  it('shows a seated member\'s seat with a link to it on the floor, and the promotions they were given', async () => {
    const onNavigate = renderAs('super_admin', 'm1');
    expect(await screen.findByRole('heading', { name: 'Sakshi Tandon', level: 2 }, { timeout: 5000 })).toBeDefined();
    // Half the width beside the record, the list keeps every column, its lines scrolling sideways (owner, 9 Nov).
    const table = screen.getByRole('table', { name: 'Members' });
    for (const column of [/^Mobile/, /^ID check/, /^Hours/, /^City/, /^Visits/]) expect(within(table).getByRole('columnheader', { name: column })).toBeDefined();
    // The list beside it names her seat too, in its Tonight column's title: the record's line is the one with Show.
    const show = await screen.findByRole('button', { name: 'Show Sakshi Tandon on the floor' });
    expect(show.parentElement?.textContent).toContain('Table 2, seat 3');
    fireEvent.click(show);
    expect(onNavigate).toHaveBeenCalledWith('/?table=t2&seat=3');
    expect(await screen.findByText(/Triple points: 300 points/)).toBeDefined();
    // A perk reads as the promotion builder names it, never its code.
    expect(screen.getByText(/Cab home: Cab home$/)).toBeDefined();
    expect(screen.getByRole('link', { name: 'Account' })).toBeDefined();
  });

  it('shows points and bonus chips apart on the record, then each bonus line, newest first (decision 0504; owner, 8 Nov)', async () => {
    renderAs('host', 'm1', 'bonus');
    expect(await screen.findByRole('heading', { name: 'Sakshi Tandon', level: 2 }, { timeout: 5000 })).toBeDefined();
    expect(screen.getByRole('link', { name: 'Points and bonus chips' }).getAttribute('aria-current')).toBe('page');
    expect(await screen.findByText('1,500', {}, { timeout: 5000 })).toBeDefined();
    // Points, to spend on rewards, apart from bonus chips, used with a buy-in: each with its own line.
    expect(screen.getByText('3,250')).toBeDefined();
    expect(screen.getByText('Spend on rewards. 500 more locked.')).toBeDefined();
    expect(screen.getByText('Used with a buy-in in the seat sheet. Never expire.')).toBeDefined();
    expect(await screen.findByText(/Buy-in · Table 2 · seated by Aditya Malhotra$/, {}, { timeout: 5000 })).toBeDefined();
    expect(screen.getByText('−1,000')).toBeDefined();
    expect(screen.getByText(/Welcome bonus$/)).toBeDefined();
    expect(screen.getByText('+2,500')).toBeDefined();
    // The player's Rewards calls it the same (owner, 8 Nov: one name each).
    expect(screen.getByRole('heading', { name: 'Bonus chips history' })).toBeDefined();
    expect(screen.queryByRole('button', { name: /Add|Give/ })).toBeNull();
  });

  it('shows what the member told the club at sign-up, and how they came (owner, 8 Nov)', async () => {
    renderAs('host', 'm1', 'signUp');
    expect(await screen.findByRole('heading', { name: 'Sakshi Tandon', level: 2 }, { timeout: 5000 })).toBeDefined();
    expect(screen.getByRole('link', { name: 'Sign-up' }).getAttribute('aria-current')).toBe('page');
    expect(await screen.findByText('Salaried', {}, { timeout: 5000 })).toBeDefined();
    for (const shown of ['19 Oct 2026', 'Weekday evenings, Weekends', "Hold'em, PLO", 'ASHU', 'instagram · social · diwali']) {
      expect(screen.getByText(shown)).toBeDefined();
    }
    // No referral code and no first visit to the site on record.
    expect(screen.getAllByText('Not given')).toHaveLength(2);
  });

  it('keeps the Account part from an admin, and goes back to the list from the record', async () => {
    const onNavigate = renderAs('admin', 'm1', 'account');
    expect(await screen.findByRole('heading', { name: 'Sakshi Tandon', level: 2 }, { timeout: 5000 })).toBeDefined();
    expect(screen.queryByRole('link', { name: 'Account' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Visits' }).getAttribute('aria-current')).toBe('page');
    fireEvent.click(screen.getByRole('button', { name: 'Back to Members' }));
    expect(onNavigate).toHaveBeenCalledWith('/members');
  });
});
