import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY, StaffVenueProvider } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { createMemoryHistory, createRootRoute, createRoute, createRouter, RouterProvider } from '@tanstack/react-router';
import { render } from '@testing-library/react';
import { vi } from 'vitest';
import type { ComponentType } from 'react';

/** The test's own clock: every age and call time is read against it. */
export const NOW = new Date('2026-11-15T16:30:00Z');

const minutesAgo = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000).toISOString();

/** A table of the club's main room at 50/100 or 100/200, open unless said. */
export function tableRow(id: string, name: string, extra: Partial<{ is_open: boolean; room: string; type: string; must_move_to_table_id: string | null }> = {}) {
  return {
    id, venue_id: 'v1', name, is_open: extra.is_open ?? true, seats: 9, position: Number(id.replace(/\D/g, '')) || 1,
    table_type_id: extra.type ?? 'tt2', must_move_to_table_id: extra.must_move_to_table_id ?? null, room: extra.room ?? 'main',
  };
}

/** A seated player: their session, table and seat, name, call time left in seconds, and what they ask for. */
export function seatRow({ session, table, seat, name, ...extra }: {
  session: string; table: string; seat: number; name: string; left?: number | null; top_up?: string | null;
  time?: { id: string; minutes: number } | null; leaving?: boolean;
}) {
  return {
    session_id: session, table_id: table, seat, member_id: `m-${session}`, full_name: name, tier_name: 'Black card', started_at: minutesAgo(60),
    must_move_order: null, away_since: null, call_time_left: extra.left === undefined ? 7200 : extra.left, leaving_at: extra.leaving === true ? minutesAgo(2) : null,
    top_up: extra.top_up ?? null, time_request_id: extra.time?.id ?? null, time_request_minutes: extra.time?.minutes ?? null,
  };
}

/** A request on the floor of a kind, for what the floor acts on (`id`), `minutes` old. */
export function requestRow({ kind, id, name, minutes, ...extra }: {
  kind: string; id: string; name: string; minutes: number; session_id?: string | null; table_id?: string; seat?: number | null;
  asked?: number | null; top_up?: string | null; owed_seconds?: number | null; call_time_left?: number | null;
}) {
  return {
    kind, request_id: id, session_id: extra.session_id ?? null, member_id: `m-${id}`, full_name: name, table_id: extra.table_id ?? 't1', seat: extra.seat ?? null,
    since: minutesAgo(minutes), minutes: extra.asked ?? null, call_time_left: extra.call_time_left ?? null, top_up: extra.top_up ?? null,
    owed_seconds: extra.owed_seconds ?? null,
  };
}

export interface FloorApi {
  role?: string;
  tables?: unknown[];
  seats?: unknown[];
  requests?: unknown[];
  board?: unknown[];
  queues?: unknown[];
  /** Each table's list length and call time, as `waitlist_lengths` gives them. */
  lengths?: unknown[];
  /** An RPC's own answer: a refusal, or a body. */
  replies?: Record<string, { status: number; body: unknown }>;
}

const TYPES = [
  { id: 'tt1', name: 'NLH 50/100', game: 'nlh', small_blind_paise: 5000, big_blind_paise: 10000, buy_in_min_paise: 500000, straddle_paise: null },
  { id: 'tt2', name: 'NLH 100/200', game: 'nlh', small_blind_paise: 10000, big_blind_paise: 20000, buy_in_min_paise: 1000000, straddle_paise: null },
];

/** The floor's reads, by RPC; any other RPC is a change, answered 204. */
function readsOf(api: FloorApi): Record<string, unknown> {
  return {
    floor_seats: api.seats ?? [], floor_requests: api.requests ?? [], waitlist_board: api.board ?? [], staff_queue_counts: api.queues ?? [],
    waitlist_lengths: api.lengths ?? [], floor_request_targets: [{ top_up_seconds: null, other_seconds: null }], add_time_choices: [30, 60, 120],
    held_seats: [], floor_open_seats: [], floor_tonight: [], waiting_spins: [],
  };
}

/** The staff member's record, the tables and their stakes: the floor's table reads. */
function restOf(url: string, api: FloorApi): unknown {
  if (url.includes('/rest/v1/staff')) {
    return [{ id: 'st1', venue_id: 'v1', full_name: 'Aditya Malhotra', role: api.role ?? 'admin', venue: { name: 'RIVR Gurugram', is_practice: false } }];
  }
  if (url.includes('/rest/v1/game_table')) return api.tables ?? [];
  return url.includes('/rest/v1/table_type') ? TYPES : [];
}

/** The answer to one request of the fake API: a reply given, a read, else 204 for a change. */
function answer(url: string, api: FloorApi): Response {
  const rpc = url.split('/rpc/')[1]?.split('?')[0];
  if (rpc === undefined) return Response.json(restOf(url, api));
  const reply = api.replies?.[rpc];
  if (reply !== undefined) return Response.json(reply.body, { status: reply.status });
  const reads = readsOf(api);
  return rpc in reads ? Response.json(reads[rpc]) : new Response(null, { status: 204 });
}

/** Renders a floor screen for a staff member (admin unless said) against a fake API; every change it sends is kept. */
export function renderFloorScreen(Screen: ComponentType, api: FloorApi = {}) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000103', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  const sent: { rpc: string; body: unknown }[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (init?.method === 'POST' && url.includes('/rpc/')) sent.push({ rpc: url.split('/rpc/')[1] ?? '', body: JSON.parse(String(init.body ?? '{}')) });
    return answer(url, api);
  });
  const rootRoute = createRootRoute();
  const screenRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: Screen });
  const membersRoute = createRoute({ getParentRoute: () => rootRoute, path: '/members', component: () => null });
  const router = createRouter({ routeTree: rootRoute.addChildren([screenRoute, membersRoute]), history: createMemoryHistory({ initialEntries: ['/'] }) });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <StaffVenueProvider><RouterProvider router={router} /></StaffVenueProvider>
    </RivrDataProvider>,
  );
  return { sent, rpcs: (name: string) => sent.filter((call) => call.rpc === name).map((call) => call.body), router };
}
