import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { ToastProvider } from '@rivr/ui';
import { QueryClient } from '@tanstack/react-query';
import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from '@tanstack/react-router';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HomeScreen } from './HomeScreen.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const NOW = Date.parse('2026-11-15T17:14:00Z');
const TABLES = [
  { id: 't1', venue_id: 'v1', name: 'Table 1', is_open: true, seats: 9, position: 1, table_type_id: 'tt1', must_move_to_table_id: null, room: 'main' },
  { id: 't4', venue_id: 'v1', name: 'Table 4', is_open: false, seats: 9, position: 4, table_type_id: 'tt1', must_move_to_table_id: null, room: 'main' },
];
const TYPES = [{ id: 'tt1', name: 'NLH 50/100', game: 'nlh', small_blind_paise: 5000, big_blind_paise: 10000, buy_in_min_paise: 500000, straddle_paise: null }];
const FEATURES = ['floor.live_view', 'waitlist.join', 'call_time.view', 'table.top_up', 'table.leave', 'fnb.table_side'].map((key) => ({ feature_key: key, state: 'enabled', tiers: null }));
const PLACE = {
  entry_id: 'e1', table_type_id: 'tt1', table_type_name: 'NLH 50/100', small_blind_paise: 5000, big_blind_paise: 10000, joined_at: '2026-11-15T17:14:00Z',
  place: 1, call_table_name: null, call_seat: null, hold_until: null, away_until: null, is_request: false, table_id: 't1', table_name: 'Table 1',
  called_at: null, on_way_at: null,
};
const SEAT = {
  table_name: 'Table 1', seat: 4, is_away: false, has_call_time: true, call_time_left: 9668, played_seconds: 1140, is_leaving: false, top_up: null,
  call_time_minutes: 180, started_at: '2026-11-15T16:55:30Z', call_time_ends_at: new Date(NOW + 9668 * 1000).toISOString(),
  table_type_name: 'NLH 50/100', small_blind_paise: 5000, big_blind_paise: 10000, time_request_minutes: null, add_time_choices: [30, 60, 120],
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

function renderTonight(places: unknown[] = [], seat: unknown[] = [], more: Record<string, unknown> = {}, at = '/') {
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

const LATER = { timeout: 5000 };

describe('Tonight', () => {
  it('Browsing: lists the tables in the sheet, a closed one dimmed, and opens the join sheet', async () => {
    renderTonight();
    const table = await screen.findByRole('button', { name: /Table 1 · NLH 50\/100/ }, LATER);
    expect(table.textContent).toContain('No wait');
    expect(table.textContent).toContain('3 open');
    expect(screen.getByText('Table 4 · NLH 50/100')).toBeDefined();
    expect(screen.getByText('Opens later')).toBeDefined();
    fireEvent.click(table);
    const sheet = await screen.findByRole('dialog', { name: "No-Limit Hold'em 50/100" });
    expect(sheet.textContent).toContain('Table 1');
    expect(screen.getByRole('img', { name: '3 of 9 seats open' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Take a seat' })).toBeDefined();
  });

  it('Browsing: lists the open tables first, a closed one between two open ones after both (owner, 3 Nov)', async () => {
    const t5 = { ...TABLES[0], id: 't5', name: 'Table 5', position: 3 };
    renderTonight([], [], {
      '/rest/v1/game_table': [TABLES[0], { ...TABLES[1], position: 2 }, t5],
      '/rpc/floor_open_seats': [{ table_id: 't1', open_seats: 3 }, { table_id: 't4', open_seats: 9 }, { table_id: 't5', open_seats: 2 }],
    });
    await screen.findByText('Table 5 · NLH 50/100', {}, LATER);
    const rows = screen.getAllByText(/^Table \d · NLH 50\/100$/).map((name) => name.textContent);
    expect(rows).toEqual(['Table 1 · NLH 50/100', 'Table 5 · NLH 50/100', 'Table 4 · NLH 50/100']);
  });

  it('Browsing: one referral reward makes one offer card, before the club\'s other promotions in the row (owner, 3 Nov)', async () => {
    renderTonight([], [], {
      '/rpc/my_feature_access': [...FEATURES, { feature_key: 'promotions.feed', state: 'enabled', tiers: null }],
      '/rpc/my_referral': [{ code: 'PGHG59H7', referred: 0, bonus_paise: 100000 }],
      // As the server lists them since 3 Nov: the promotion behind the referral card is not a card again.
      '/rpc/my_promotion_cards': [
        { promotion_id: 'p1', title: 'High hands', detail: 'Royal flush 25,000', runs: 'Every night', link: null },
        { promotion_id: 'p2', title: 'Buy-in bonus Tuesday', detail: '20% on the first five buy-ins per table', runs: 'Tuesday · all stakes',
          link: 'https://glaza.example/tuesday' },
      ],
    });
    const offers = (await screen.findByText('3 offers', {}, LATER)).closest('section');
    if (offers === null) throw new Error('No offers row');
    expect(within(offers).getAllByText('Referral')).toHaveLength(1);
    expect(within(offers).getAllByRole('listitem')).toHaveLength(3);
    // A card with a link opens it (issue 776); one without only says its offer.
    expect(within(offers).getByRole('link', { name: /Buy-in bonus Tuesday/ }).getAttribute('href')).toBe('https://glaza.example/tuesday');
    expect(within(offers).queryByRole('link', { name: /High hands/ })).toBeNull();
  });

  it('On the list: the place, Next in line, when they joined, and Leave waitlist', async () => {
    renderTonight([PLACE]);
    expect(await screen.findByText('Next in line', {}, LATER)).toBeDefined();
    expect(screen.getByText('Waitlist · Table 1 · NLH 50/100')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Leave waitlist' })).toBeDefined();
  });

  it('Seat ready: where, the hold counting down from the server\'s time, and the two answers', async () => {
    renderTonight([{ ...PLACE, call_table_name: 'Table 1', call_seat: 4, called_at: '2026-11-15T17:04:00Z', hold_until: '2026-11-15T17:24:00Z' }]);
    expect(await screen.findByText('Your seat is ready', {}, LATER)).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Table 1, seat 4' })).toBeDefined();
    expect(screen.getByRole('timer', { name: 'Seat held for 10 min' }).textContent).toBe('10:00');
    expect(screen.getByRole('button', { name: "I'm on my way" })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Decline seat' })).toBeDefined();
  });

  it('Seated: the seat in the header and the call time counting down to its end', async () => {
    renderTonight([], [SEAT]);
    expect(await screen.findByRole('heading', { name: 'Table 1 · Seat 4' }, LATER)).toBeDefined();
    expect(screen.getByText('NLH 50/100 · playing 19 min')).toBeDefined();
    expect(screen.getByRole('timer', { name: 'Call time left 2h 41m' }).textContent).toBe('2:41:08');
  });

  // Issue 781: the floor can add a seated member to another list to change tables (#633).
  it('Seated: a place on a list to change tables shows under the seat, with where they stand', async () => {
    renderTonight([{ ...PLACE, place: 2, table_id: null, table_name: null }, { ...PLACE, entry_id: 'e2', place: null, is_request: true },
      { ...PLACE, entry_id: 'e3', table_name: 'Table 2', call_table_name: 'Table 2', call_seat: 3, hold_until: new Date(NOW + 600_000).toISOString() }], [SEAT]);
    expect(await screen.findByText('Waitlist · NLH 50/100', {}, LATER)).toBeDefined();
    expect(screen.getByText('2nd in line')).toBeDefined();
    expect(screen.getByText('Waitlist · Table 1 · NLH 50/100')).toBeDefined();
    expect(screen.getByText('Requested')).toBeDefined();
    // Called to the new table, the place says its seat is held.
    expect(screen.getByText('Waitlist · Table 2 · NLH 50/100')).toBeDefined();
    expect(screen.getByText('Your seat is ready')).toBeDefined();
    // Still the seat's screen, not the place's.
    expect(screen.getByRole('button', { name: 'Leave seat' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Leave waitlist' })).toBeNull();
  });

  it('Add time: asks the floor for 30 min, 1 hour or 2 hours, and shows the request waiting', async () => {
    renderTonight([], [{ ...SEAT, top_up: 'requested', time_request_minutes: 60 }]);
    expect(await screen.findByText('+1 h', {}, LATER)).toBeDefined();
    expect(screen.getByText('Top-up')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Add time' }).getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByRole('button', { name: 'Top up' }).getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Leave seat' }));
    expect(await screen.findByRole('dialog', { name: 'Leave your seat?' })).toBeDefined();
    expect(screen.getByText('2h 41m call time left.')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Join leaving list' })).toBeDefined();
  });

  it('Add time sheet: an hour unless changed, then Request it', async () => {
    renderTonight([], [SEAT]);
    fireEvent.click(await screen.findByRole('button', { name: 'Add time' }, LATER));
    expect(await screen.findByRole('dialog', { name: 'Add time' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Request 1 hour' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: '2 hours' }));
    expect(screen.getByRole('button', { name: 'Request 2 hours' })).toBeDefined();
  });

  it('Add time once the call time is met, with the lengths the club ticked (decision 0305)', async () => {
    renderTonight([], [{ ...SEAT, call_time_left: 0, call_time_ends_at: null, add_time_choices: [45, 90] }]);
    fireEvent.click(await screen.findByRole('button', { name: 'Add time' }, LATER));
    expect(await screen.findByRole('dialog', { name: 'Add time' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Request 45 min' })).toBeDefined();
    expect(screen.getByRole('button', { name: '1 hour 30' })).toBeDefined();
    expect(screen.queryByRole('button', { name: '2 hours' })).toBeNull();
  });

  it('Order on its way: the tracker reads where the order is, from the bar\'s steps', async () => {
    renderTonight([], [SEAT], { '/rpc/my_fnb_orders': [{
      order_id: 'o1', kot_number: 7, created_at: '2026-11-15T17:00:00Z', accepted_at: '2026-11-15T17:02:00Z', on_way_at: '2026-11-15T17:10:00Z',
      delivered_at: null, cancelled_at: null, cancel_reason: null, lines: [{ item_id: 'i1', name: 'Club sandwich', kind: 'food', quantity: 1, note: null }, { item_id: 'i2', name: 'Beer', kind: 'bar', quantity: 2, note: null }],
    }] });
    expect(await screen.findByText('Club sandwich, 2 × Beer', {}, LATER)).toBeDefined();
    expect(screen.getByRole('list', { name: 'Order' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Order to my seat' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Order again' })).toBeNull();
  });

  it('Call time ending push: Add time opens its sheet, and the address is cleaned', async () => {
    const { router } = renderTonight([], [SEAT], {}, '/?sheet=add-time');
    expect(await screen.findByRole('dialog', { name: 'Add time' }, LATER)).toBeDefined();
    expect(router.state.location.search).toEqual({});
  });

  it('Seat ready push: I\'m on my way tells the floor for the place it names, once', async () => {
    const called = { ...PLACE, call_table_name: 'Table 1', call_seat: 4, called_at: '2026-11-15T17:04:00Z', hold_until: '2026-11-15T17:24:00Z' };
    const { router, asked } = renderTonight([called], [], {}, '/?accept=e1');
    expect(await screen.findByText('Your seat is ready', {}, LATER)).toBeDefined();
    await vi.waitFor(() => expect(asked.filter((call) => call.startsWith('accept_seat_call'))).toEqual(['accept_seat_call {"p_entry_id":"e1"}']));
    expect(router.state.location.search).toEqual({});
  });

  it('Seat ready push for a call that is over: nothing is sent', async () => {
    const { router, asked } = renderTonight([], [SEAT], {}, '/?accept=e1');
    expect(await screen.findByRole('heading', { name: 'Table 1 · Seat 4' }, LATER)).toBeDefined();
    await vi.waitFor(() => expect(router.state.location.search).toEqual({}));
    expect(asked.filter((call) => call.startsWith('accept_seat_call'))).toEqual([]);
  });

  it('Order: an order staff voided says it was cancelled and why, with Order again (decision 0302)', async () => {
    renderTonight([], [SEAT], { '/rpc/my_fnb_orders': [{
      order_id: 'o1', kot_number: 7, created_at: '2026-11-15T17:00:00Z', accepted_at: '2026-11-15T17:02:00Z', on_way_at: null, delivered_at: null,
      cancelled_at: '2026-11-15T17:05:00Z', cancel_reason: 'Out of milk', lines: [{ item_id: 'i1', name: 'Masala chai', kind: 'soft_drink', quantity: 1, note: null }],
    }] });
    expect(await screen.findByText('Cancelled: Out of milk', {}, LATER)).toBeDefined();
    expect(screen.queryByRole('list', { name: 'Order' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Order again' })).toBeDefined();
  });

  it('Rate your visit: a visit with no table played says Tonight, with no time or table', async () => {
    renderTonight([], [], { '/rpc/my_feedback_visit': [{ visit_id: 'v1', closed_at: '2026-11-15T16:00:00Z', played_seconds: 0, table_name: null }] });
    expect(await screen.findByRole('heading', { name: 'How was your night?' }, LATER)).toBeDefined();
    expect(screen.getByText('Tonight', { selector: 'p' })).toBeDefined();
    expect(screen.queryByText(/ at $/)).toBeNull();
  });

  it('On a break (decision 0300): a banner says until when, and a table offers no join', async () => {
    renderTonight([], [], { '/rpc/my_restrictions': [{ break_until: '2026-11-20T12:00:00Z', session_reminder_hours: null }] });
    expect(await screen.findByText(/^On a break until /, {}, LATER)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /Table 1 · NLH 50\/100/ }));
    expect(await screen.findByRole('dialog', { name: "No-Limit Hold'em 50/100" })).toBeDefined();
    expect(screen.getAllByText(/^On a break until /)).toHaveLength(2);
    expect(screen.queryByRole('button', { name: /^(Take a seat|Join waitlist)$/ })).toBeNull();
  });

  it('Browsing: the tournaments under the tables say Notify me, Notifying you, or Registered once the floor has', async () => {
    renderTonight([], [], {
      '/rpc/my_feature_access': [...FEATURES, { feature_key: 'tournaments.register', state: 'enabled', tiers: null }],
      '/rpc/my_upcoming_tournaments': [
        { tournament_id: 't1', name: 'Weeknight Turbo', starts_at: '2026-11-17T14:30:00Z', standing: 'none' },
        { tournament_id: 't2', name: 'Sunday Main Event', starts_at: '2026-11-22T08:30:00Z', standing: 'interested' },
        { tournament_id: 't3', name: 'Ladies Night', starts_at: '2026-11-19T14:30:00Z', standing: 'registered' },
      ],
    });
    expect((await screen.findByRole('button', { name: 'Register interest in Weeknight Turbo' }, LATER)).textContent).toBe('Notify me');
    expect(screen.getByRole('button', { name: 'Register interest in Sunday Main Event' }).textContent).toBe('Notifying you');
    expect(screen.getByRole('button', { name: 'Register interest in Ladies Night' }).textContent).toBe('Registered');
  });

  it('Errors › Club paused: a red banner on Tonight, and a table offers no join', async () => {
    renderTonight([], [], { '/rest/v1/control_state': [{ venue_id: 'v1', level: 'venue_freeze', feature: null, member_id: null, released_at: null }] });
    expect(await screen.findByText('The club is paused. Ask a member of staff.', {}, LATER)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /^Table 1 · / }));
    const paused = await screen.findByRole('button', { name: 'The club is paused' });
    expect(paused.hasAttribute('disabled')).toBe(true);
  });

  it('Browsing: Notify me says why it did not go through', async () => {
    renderTonight([], [], {
      '/rpc/my_feature_access': [...FEATURES, { feature_key: 'tournaments.register', state: 'enabled', tiers: null }],
      '/rpc/my_upcoming_tournaments': [{ tournament_id: 't1', name: 'Weeknight Turbo', starts_at: '2026-11-17T14:30:00Z', standing: 'none' }],
      '/rpc/register_tournament_interest': Response.json({ code: 'RVFRZ', message: 'paused' }, { status: 400 }),
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Register interest in Weeknight Turbo' }, LATER));
    expect(await screen.findByText('The club is paused. Try again later.')).toBeDefined();
  });
});
