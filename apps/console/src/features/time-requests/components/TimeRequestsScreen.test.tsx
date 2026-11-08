import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY, StaffVenueProvider } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TimeRequestsScreen } from './TimeRequestsScreen.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

/** A seated player at Table 3: `left` seconds of call time, and more asked for, or none. */
const seat = ({ session, seat: number, name, left, request }: { session: string; seat: number; name: string; left: number; request: { id: string; minutes: number } | null }) => ({
  session_id: session, table_id: 't3', seat: number, member_id: `m-${session}`, full_name: name, tier_name: 'Gold', started_at: '2026-11-15T16:00:00Z',
  must_move_order: null, away_since: null, call_time_left: left, leaving_at: null, top_up: null,
  time_request_id: request?.id ?? null, time_request_minutes: request?.minutes ?? null,
});
const ROHAN = seat({ session: 's3', seat: 2, name: 'Rohan Bhatia', left: 3600, request: null });

/** Aditya, a floor manager, on Time requests: Kabir asks for an hour with 20 minutes left, Naina for 30 minutes once met. */
function renderTimeRequests(seats = [seat({ session: 's1', seat: 5, name: 'Kabir Sethi', left: 1200, request: { id: 'r1', minutes: 60 } }),
  seat({ session: 's2', seat: 1, name: 'Naina Kapoor', left: 0, request: { id: 'r2', minutes: 30 } }), ROHAN]) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000103', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  const decided: unknown[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/rest/v1/staff')) {
      return Response.json([{ id: 'st1', venue_id: 'v1', full_name: 'Aditya Malhotra', role: 'admin', venue: { name: 'RIVR Gurugram', is_practice: false } }]);
    }
    if (url.includes('/rest/v1/game_table')) {
      return Response.json([{ id: 't3', venue_id: 'v1', name: 'Table 3', is_open: true, seats: 9, position: 3, table_type_id: 'tt1', must_move_to_table_id: null, room: 'main' }]);
    }
    if (url.includes('/rest/v1/table_type')) {
      return Response.json([{ id: 'tt1', name: 'NLH 50/100', game: 'nlh', small_blind_paise: 5000, big_blind_paise: 10000, buy_in_min_paise: 500000, straddle_paise: null }]);
    }
    if (url.includes('/rpc/floor_seats')) return Response.json(seats);
    if (url.includes('/rpc/decide_call_time_request')) {
      decided.push(JSON.parse(String(init?.body)));
      return new Response(null, { status: 204 });
    }
    return Response.json([]);
  });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <StaffVenueProvider><TimeRequestsScreen /></StaffVenueProvider>
    </RivrDataProvider>,
  );
  return decided;
}

describe('Time requests (decision 0305)', () => {
  it('lists each request with its table, seat, how much was asked and the call time left or met; no one who did not ask', async () => {
    renderTimeRequests();
    // The first read waits as long as other screens' do: CI's machines are slow under load.
    expect(await screen.findByText('Table 3, seat 5 · Kabir Sethi', {}, { timeout: 5000 })).toBeDefined();
    expect(screen.getByText('Table 3, seat 1 · Naina Kapoor')).toBeDefined();
    expect(screen.getByText('Call time done')).toBeDefined();
    expect(screen.getByText(/call time left$/)).toBeDefined();
    expect(screen.queryByText(/Rohan Bhatia/)).toBeNull();
  });

  it('approves one request and declines another from their lines', async () => {
    const decided = renderTimeRequests();
    fireEvent.click(await screen.findByRole('button', { name: 'Approve more call time for Kabir Sethi' }, { timeout: 5000 }));
    await waitFor(() => expect(decided).toEqual([{ p_request_id: 'r1', p_is_approved: true }]));
    fireEvent.click(screen.getByRole('button', { name: 'Decline more call time for Naina Kapoor' }));
    await waitFor(() => expect(decided).toEqual([{ p_request_id: 'r1', p_is_approved: true }, { p_request_id: 'r2', p_is_approved: false }]));
  });

  it('says when none waits', async () => {
    renderTimeRequests([ROHAN]);
    expect(await screen.findByText('No time requests waiting.', {}, { timeout: 5000 })).toBeDefined();
  });
});
