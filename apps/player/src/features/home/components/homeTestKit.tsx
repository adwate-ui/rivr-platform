import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { ToastProvider } from '@rivr/ui';
import { QueryClient } from '@tanstack/react-query';
import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from '@tanstack/react-router';
import { render } from '@testing-library/react';
import { vi } from 'vitest';
import { HomeScreen } from './HomeScreen.tsx';

// What Home's two test files share: tonight's tables, a place, a seat, and Home drawn over a fake API.
export const NOW = Date.parse('2026-11-15T17:14:00Z');
export const TABLES = [
  // Its own minimum, ₹7,350: not the ₹5,000 its stake still carries (redesign RD-16).
  { id: 't1', venue_id: 'v1', name: 'Table 1', is_open: true, seats: 9, position: 1, table_type_id: 'tt1', must_move_to_table_id: null, room: 'main', min_buy_in_paise: 735000 },
  { id: 't4', venue_id: 'v1', name: 'Table 4', is_open: false, seats: 9, position: 4, table_type_id: 'tt1', must_move_to_table_id: null, room: 'main', min_buy_in_paise: 500000 },
];
export const TYPES = [{ id: 'tt1', name: 'NLH 50/100', game: 'nlh', small_blind_paise: 5000, big_blind_paise: 10000, straddle_paise: null, buy_in_min_paise: 500000 }];
export const FEATURES = ['floor.live_view', 'waitlist.join', 'call_time.view', 'table.top_up', 'table.leave', 'fnb.table_side'].map((key) => ({ feature_key: key, state: 'enabled', tiers: null }));
export const PLACE = {
  entry_id: 'e1', table_type_id: 'tt1', table_type_name: 'NLH 50/100', small_blind_paise: 5000, big_blind_paise: 10000, joined_at: '2026-11-15T17:14:00Z',
  place: 1, call_table_name: null, call_seat: null, hold_until: null, away_until: null, is_request: false, table_id: 't1', table_name: 'Table 1',
  called_at: null, on_way_at: null, game: 'nlh', straddle_paise: null,
};
export const SEAT = {
  table_name: 'Table 1', seat: 4, is_away: false, has_call_time: true, call_time_left: 9668, played_seconds: 1140, is_leaving: false, top_up: null,
  call_time_minutes: 180, started_at: '2026-11-15T16:55:30Z', call_time_ends_at: new Date(NOW + 9668 * 1000).toISOString(),
  table_type_name: 'NLH 50/100', small_blind_paise: 5000, big_blind_paise: 10000, time_request_minutes: null, add_time_choices: [30, 60, 120], game: 'nlh', straddle_paise: null,
  call_time_set_at: null,
};

/** The answers the screen's reads get: each table, the member's places and seat as the test says, then the test's own. */
function answers(places: unknown[], seat: unknown[], more: Record<string, unknown>): Record<string, unknown> {
  return {
    '/rest/v1/game_table': TABLES, '/rest/v1/table_type': TYPES, '/rpc/my_feature_access': FEATURES,
    '/rpc/waitlist_lengths': [{ table_id: 't1', waiting: 0, call_time_minutes: 180 }, { table_id: 't4', waiting: 0, call_time_minutes: 180 }],
    '/rpc/floor_open_seats': [{ table_id: 't1', open_seats: 3 }, { table_id: 't4', open_seats: 9 }],
    '/rpc/floor_taken_seats': [1, 3, 5, 6, 8, 9].map((seatNumber) => ({ table_id: 't1', seat: seatNumber })),
    '/rpc/my_waitlist': places, '/rpc/my_seat': seat,
    ...more,
  };
}

export function renderTonight(places: unknown[] = [], seat: unknown[] = [], more: Record<string, unknown> = {}, at = '/') {
  vi.useFakeTimers({ now: NOW, shouldAdvanceTime: true });
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(NOW / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000211', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  const replies = answers(places, seat, more);
  const asked: string[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (init?.method === 'POST') asked.push(`${url.replace(/^.*\/rpc\//, '')} ${String(init.body)}`);
    const key = Object.keys(replies).find((path) => url.includes(`${path}?`) || url.endsWith(path));
    const reply = key === undefined ? [] : replies[key];
    // A reply may be a whole Response, as a refusal is.
    return reply instanceof Response ? reply.clone() : Response.json(reply);
  });
  const rootRoute = createRootRoute({ component: () => <ToastProvider><HomeScreen offer={null} /></ToastProvider> });
  const router = createRouter({ routeTree: rootRoute, history: createMemoryHistory({ initialEntries: [at] }) });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <RouterProvider router={router} />
    </RivrDataProvider>,
  );
  return { router, asked };
}

export const LATER = { timeout: 5000 };

/** A member the desk has verified, two notices in force (the one that started last first, as the server lists them) and two live promotions. */
export const VERIFIED = { status: 'verified', photo_path: null, date_of_birth: null, masked_aadhaar: null, pan: null, at_club_from: null };
export const HOME = {
  '/rest/v1/kyc_record': VERIFIED,
  '/rpc/my_feature_access': [...FEATURES, { feature_key: 'promotions.feed', state: 'enabled', tiers: null }],
  '/rpc/my_notices': [
    { notice_id: 'n2', body: 'Kitchen closes at 1 tonight.', starts_at: '2026-11-15T15:00:00Z' },
    { notice_id: 'n1', body: 'Valet parking at the back gate.', starts_at: '2026-11-15T12:00:00Z' },
  ],
  '/rpc/my_promotion_cards': [
    { promotion_id: 'p1', title: 'Friday four-hour bonus', detail: '1,000 Bonus after 4 hours', runs: 'Every day, all tables', link: null },
    { promotion_id: 'p2', title: 'Happy hour', detail: '2-for-1 at the Glaza bar', runs: 'Daily, 19:00 to 21:00', link: null },
  ],
};

/** Whether `later` comes after `earlier` on the page. */
export const follows = (earlier: Element, later: Element) => (earlier.compareDocumentPosition(later) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

/** Long enough for every read to land and whatever it brings to be drawn. */
export const settled = () => vi.advanceTimersByTimeAsync(200);
