import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY, StaffVenueProvider } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
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
  // Bonus chips (decision 0504): the history before the balance, whose path it starts with.
  '/rpc/member_bonus_history': [
    { line_id: 'r1', at: '2026-11-03T14:00:00Z', kind: 'redeemed', amount_paise: 100_000, reason: null, table_name: 'Table 2', staff_name: 'Aditya Malhotra' },
    { line_id: 'b1', at: '2026-11-02T14:00:00Z', kind: 'credited', amount_paise: 250_000, reason: 'Welcome bonus', table_name: null, staff_name: null },
  ],
  '/rpc/member_bonus': [{ bonus_paise: 150_000 }],
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
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <StaffVenueProvider><MembersScreen memberId={memberId} part={part} onNavigate={onNavigate} /></StaffVenueProvider>
    </RivrDataProvider>,
  );
  return onNavigate;
}

describe('Members (console v3)', () => {
  it('lists every member on open with where each is tonight, and opens a record in the address', async () => {
    const onNavigate = renderAs('super_admin');
    const table = await screen.findByRole('table', { name: 'Members' }, { timeout: 5000 });
    expect(screen.queryByText(/^Search by/)).toBeNull();
    expect(await within(table).findByText('Table 2 · 3')).toBeDefined();
    expect(within(table).getByText('Waiting')).toBeDefined();
    for (const header of ['Name', 'No.', 'Tier', 'Tonight', 'Visits']) expect(within(table).getByRole('columnheader', { name: new RegExp(header) })).toBeDefined();
    fireEvent.click(within(table).getByRole('button', { name: 'Arjun Mehta' }));
    expect(onNavigate).toHaveBeenCalledWith('/members?member=m2');
  });

  it('shows each member\'s KYC, hours played, city and member-since day, and the mobile to a super admin (owner, 8 Nov)', async () => {
    renderAs('super_admin');
    const table = await screen.findByRole('table', { name: 'Members' }, { timeout: 5000 });
    for (const header of ['Mobile', 'KYC', 'Hours played', 'City', 'Member since']) {
      expect(within(table).getByRole('columnheader', { name: new RegExp(header) })).toBeDefined();
    }
    const sakshi = within(table).getAllByRole('row').find((row) => row.textContent?.includes('Sakshi Tandon')) ?? table;
    for (const shown of ['+91 90000 00266', 'Verified', '2h 15m', 'Gurugram', '20 Oct 2026']) expect(sakshi.textContent).toContain(shown);
    const arjun = within(table).getAllByRole('row').find((row) => row.textContent?.includes('Arjun Mehta')) ?? table;
    expect(arjun.textContent).toContain('Desk check');
  });

  it('keeps the mobile column from other staff, who find a member by the last four digits of their number', async () => {
    renderAs('admin');
    const table = await screen.findByRole('table', { name: 'Members' }, { timeout: 5000 });
    expect(within(table).queryByRole('columnheader', { name: /Mobile/ })).toBeNull();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Name, member no. or mobile' }), { target: { value: '98100 00263' } });
    expect(within(table).getByRole('button', { name: 'Arjun Mehta' })).toBeDefined();
    expect(within(table).queryByRole('button', { name: 'Sakshi Tandon' })).toBeNull();
  });

  it('narrows the list by a name as typed or a member number, and says when nothing matches', async () => {
    renderAs('super_admin');
    const table = await screen.findByRole('table', { name: 'Members' }, { timeout: 5000 });
    const search = screen.getByRole('searchbox', { name: 'Name, member no. or mobile' });
    fireEvent.change(search, { target: { value: 'sak' } });
    expect(within(table).getByRole('button', { name: 'Sakshi Tandon' })).toBeDefined();
    expect(within(table).queryByRole('button', { name: 'Arjun Mehta' })).toBeNull();
    fireEvent.change(search, { target: { value: '63' } });
    expect(within(table).getByRole('button', { name: 'Arjun Mehta' })).toBeDefined();
    expect(within(table).queryByRole('button', { name: 'Sakshi Tandon' })).toBeNull();
    fireEvent.change(search, { target: { value: 'Zoya' } });
    expect(await screen.findByText('No member matches Zoya.')).toBeDefined();
  });

  it('shows a seated member\'s seat with a link to it on the floor, and the promotions they were given', async () => {
    const onNavigate = renderAs('super_admin', 'm1');
    expect(await screen.findByRole('heading', { name: 'Sakshi Tandon', level: 2 }, { timeout: 5000 })).toBeDefined();
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

  it('shows the member’s bonus chips on the record, read only: the balance and each line, newest first (decision 0504)', async () => {
    renderAs('host', 'm1', 'bonus');
    expect(await screen.findByRole('heading', { name: 'Sakshi Tandon', level: 2 }, { timeout: 5000 })).toBeDefined();
    expect(screen.getByRole('link', { name: 'Bonus chips' }).getAttribute('aria-current')).toBe('page');
    expect(await screen.findByText('1,500', {}, { timeout: 5000 })).toBeDefined();
    expect(await screen.findByText(/Buy-in · Table 2 · seated by Aditya Malhotra$/, {}, { timeout: 5000 })).toBeDefined();
    expect(screen.getByText('−1,000')).toBeDefined();
    expect(screen.getByText(/Welcome bonus$/)).toBeDefined();
    expect(screen.getByText('+2,500')).toBeDefined();
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
