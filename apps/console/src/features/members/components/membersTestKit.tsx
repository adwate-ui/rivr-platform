import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY, StaffVenueProvider } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from '@tanstack/react-router';
import { render } from '@testing-library/react';
import { vi } from 'vitest';
import { MembersScreen } from './MembersScreen.tsx';

// What the Members screen's tests share: a fake API with two members, and the screen drawn for a staff member's role.

export const SAKSHI = {
  total: 2, member_id: 'm1', member_number: 66, full_name: 'Sakshi Tandon', phone: '+919000000266', phone_last4: '0266', tier_name: 'Black card', visits: 1,
  last_visit_at: '2026-11-03T12:00:00Z', kyc_status: 'verified', minutes_played: 135, city: 'Gurugram', member_since: '2026-10-20T10:00:00Z', bonus_paise: 150_000,
};
// As an admin reads him: no full number, only its last four digits.
export const ARJUN = { ...SAKSHI, member_id: 'm2', member_number: 63, full_name: 'Arjun Mehta', visits: 7, phone: null, phone_last4: '0263', kyc_status: 'at_desk',
  minutes_played: 0, city: null, bonus_paise: 0 };
const RECORD = {
  member_id: 'm1', member_number: 66, full_name: 'Sakshi Tandon', known_as: null, phone: '+919000000266', tier_id: 'tr1', tier_name: 'Black card',
  tier_until: null, is_kyc_complete: true, photo_path: null, qualifying_small_blind: null, qualifying_big_blind: null, visits: 1,
  last_visit_at: '2026-11-03T12:00:00Z', is_in_room: true, early_departures: 0,
};
const SEAT = { session_id: 's1', table_id: 't2', seat: 3, member_id: 'm1', full_name: 'Sakshi Tandon', tier_name: 'Black card', started_at: '2026-11-03T12:00:00Z',
  must_move_order: null, away_since: null, call_time_left: null, leaving_at: null, top_up: null,
  call_time_set_at: null, call_time_ends_at: null, owes_call_time: false, call_time_after_at: null, call_time_set_by_member: null, call_time_change_id: null };
const TODAY = { member_id: 'm2', full_name: 'Arjun Mehta', member_number: 63, status: 'waiting', checked_in_at: null, checked_out_at: null, waiting_seconds: 540, tables: [] };
export const GRANT = { grant_id: 'g1', granted_at: '2026-11-03T13:00:00Z', club_day: '2026-11-03', promotion_name: 'Tuesday bonus', version: 2, chips: 1_000, perk: null };
const PERK = { ...GRANT, grant_id: 'g2', promotion_name: 'Founders priority', chips: 0, perk: 'waitlist_priority' };

const ANSWERS: Record<string, unknown> = {
  '/rpc/member_record': [RECORD], '/rpc/floor_seats': [SEAT], '/rpc/todays_players': [TODAY],
  '/rest/v1/game_table': [{ id: 't2', venue_id: 'v1', name: 'Table 2', is_open: true, seats: 9, position: 2, table_type_id: 'tt1', must_move_to_table_id: null, room: 'main', min_buy_in_paise: 1000000 }],
  '/rest/v1/table_type': [{ id: 'tt1', name: 'NLH 100/200', game: 'nlh', small_blind_paise: 10000, big_blind_paise: 20000, straddle_paise: null }],
  '/rpc/member_promotion_grants': [GRANT, PERK],
  '/rpc/member_account_statuses': [{ member_id: 'm1', status: 'on_break', until: '2026-12-13T12:00:00Z' }],
  // What the column menus offer, as the server counts it over every member.
  '/rpc/members_choices': [
    { column_key: 'status', value: 'active', members: 4810 }, { column_key: 'status', value: 'frozen', members: 1 }, { column_key: 'status', value: 'erased', members: 1 },
    { column_key: 'city', value: 'Gurugram', members: 3100 }, { column_key: 'kyc', value: 'at_desk', members: 12 }, { column_key: 'tonight', value: 'seated', members: 30 },
  ],
  '/rpc/member_visits': [
    { visit_id: 'v1', opened_at: '2026-11-03T14:00:00Z', closed_at: '2026-11-03T20:00:00Z', tables: 'Table 1, Table 3', minutes_played: 300, call_time_met: true, left_early: false },
    { visit_id: 'v2', opened_at: '2026-11-02T14:00:00Z', closed_at: '2026-11-02T16:00:00Z', tables: 'Table 1', minutes_played: 60, call_time_met: false, left_early: true,
      leave_reasons: ['busted', 'call_time_met'] },
  ],
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

/** A view the list asked the server for, as `members_page` was sent it. */
export interface AskedView {
  readonly query: string;
  readonly page: number;
  readonly page_size: number;
  readonly tier_id: string;
  readonly sort: { readonly key: string; readonly direction: string } | null;
  readonly filters: Readonly<Record<string, { readonly kind: string; readonly chosen?: readonly string[] }>>;
}

/**
 * The page a view leaves, as the server would give it of the two members: a name by any part, a member number exactly,
 * and Status narrowed to Frozen leaves Sakshi.
 */
function pageOf(view: AskedView): readonly object[] {
  const typed = view.query.toLowerCase();
  const found = [SAKSHI, ARJUN].filter((row) => typed === '' || row.full_name.toLowerCase().includes(typed) || String(row.member_number) === typed);
  const left = view.filters['status']?.chosen?.includes('frozen') === true ? found.filter((row) => row.member_id === 'm1') : found;
  return left.map((row) => ({ ...row, total: left.length }));
}

/** A test's own answer to a read: given how many were asked for, the rows, or a Response for a failure. */
export type Overrides = Readonly<Record<string, (limit: number) => unknown>>;

function answerOf(override: (limit: number) => unknown, init?: RequestInit): Response {
  const answer = override(Number(/"p_limit":(\d+)/.exec(String(init?.body))?.[1] ?? 20));
  return answer instanceof Response ? answer : Response.json(answer);
}

/** Rows of a paged list, each from `row`, as many as were asked for up to `total`. */
export const paged = (total: number, row: (n: number) => unknown) => (limit: number) => Array.from({ length: Math.min(total, limit) }, (_, n) => row(n));

/** A staff member in `role` on Members, with the member `memberId`'s record open when given; gives where it navigated and every view asked of the server. */
export function renderAs(role: string, memberId?: string, part?: string, overrides: Overrides = {}) {
  const asked: AskedView[] = [];
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000101', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    const override = Object.entries(overrides).find(([path]) => url.includes(path))?.[1];
    if (override !== undefined) return answerOf(override, init);
    if (url.includes('/rest/v1/staff')) {
      return Response.json([{ id: 'st1', venue_id: 'v1', full_name: 'Vikram Rao', role, venue: { name: 'RIVR Gurugram', is_practice: false } }]);
    }
    if (url.includes('/rpc/members_page')) {
      const view: AskedView = JSON.parse(String(init?.body)).p_view;
      asked.push(view);
      return Response.json(pageOf(view));
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
  return { onNavigate, asked };
}
