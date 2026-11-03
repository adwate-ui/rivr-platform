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

const SAKSHI = { member_id: 'm1', member_number: 66, full_name: 'Sakshi Tandon', phone: '+919000000266', tier_name: 'Black card', visits: 1, last_visit_at: '2026-11-03T12:00:00Z' };
const ARJUN = { ...SAKSHI, member_id: 'm2', member_number: 63, full_name: 'Arjun Mehta', visits: 7 };
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
  '/rpc/member_search': [SAKSHI, ARJUN], '/rpc/member_record': [RECORD], '/rpc/floor_seats': [SEAT], '/rpc/todays_players': [TODAY],
  '/rest/v1/game_table': [{ id: 't2', venue_id: 'v1', name: 'Table 2', is_open: true, seats: 9, position: 2, table_type_id: 'tt1', must_move_to_table_id: null, room: 'main' }],
  '/rest/v1/table_type': [{ id: 'tt1', name: 'NLH 100/200', game: 'nlh', small_blind_paise: 10000, big_blind_paise: 20000, buy_in_min_paise: 1000000, straddle_paise: null }],
  '/rpc/member_promotion_grants': [GRANT, PERK],
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
  it('lists the members found with where each is tonight, and opens a record in the address', async () => {
    const onNavigate = renderAs('super_admin');
    fireEvent.change(await screen.findByRole('searchbox', { name: 'Name, member no. or mobile' }, { timeout: 5000 }), { target: { value: 'sa' } });
    const table = await screen.findByRole('table', { name: 'Members' });
    expect(await within(table).findByText('Table 2 · 3')).toBeDefined();
    expect(within(table).getByText('Waiting')).toBeDefined();
    for (const header of ['Name', 'No.', 'Tier', 'Tonight', 'Visits']) expect(within(table).getByRole('columnheader', { name: new RegExp(header) })).toBeDefined();
    fireEvent.click(within(table).getByRole('button', { name: 'Arjun Mehta' }));
    expect(onNavigate).toHaveBeenCalledWith('/members?member=m2');
  });

  it('shows a seated member\'s seat with a link to it on the floor, and the promotions they were given', async () => {
    const onNavigate = renderAs('super_admin', 'm1');
    expect(await screen.findByRole('heading', { name: 'Sakshi Tandon', level: 2 }, { timeout: 5000 })).toBeDefined();
    expect(await screen.findByText('Table 2, seat 3')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Show Sakshi Tandon on the floor' }));
    expect(onNavigate).toHaveBeenCalledWith('/?table=t2&seat=3');
    expect(await screen.findByText(/Triple points: 300 points/)).toBeDefined();
    // A perk reads as the promotion builder names it, never its code.
    expect(screen.getByText(/Cab home: Cab home$/)).toBeDefined();
    expect(screen.getByRole('link', { name: 'Account' })).toBeDefined();
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
