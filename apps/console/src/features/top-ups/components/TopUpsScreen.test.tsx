import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY, StaffVenueProvider } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TopUpsScreen } from './TopUpsScreen.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const ago = (seconds: number) => new Date(Date.now() - seconds * 1000).toISOString();
const REQUESTS = [
  { request_id: 'r1', session_id: 's1', table_name: 'Table 3', seat: 5, full_name: 'Kabir Sethi', status: 'requested', requested_at: ago(95), fulfilled_seconds: null },
  { request_id: 'r2', session_id: 's2', table_name: 'Table 2', seat: 1, full_name: 'Naina Kapoor', status: 'in_progress', requested_at: ago(20), fulfilled_seconds: null },
  { request_id: 'r3', session_id: 's3', table_name: 'Table 2', seat: 4, full_name: 'Rohan Bhatia', status: 'fulfilled', requested_at: ago(900), fulfilled_seconds: 48 },
];

/** Sana, a cashier (waitlist.manage), on Top-ups with tonight's three requests; every top-up set is kept. */
function renderTopUps() {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000104', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  const set: unknown[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/rest/v1/staff')) {
      return Response.json([{ id: 'st1', venue_id: 'v1', full_name: 'Sana Qureshi', role: 'cashier', venue: { name: 'RIVR Gurugram', is_practice: false } }]);
    }
    if (url.includes('/rpc/top_ups_tonight')) return Response.json(REQUESTS);
    if (url.includes('/rpc/set_top_up')) {
      set.push(JSON.parse(String(init?.body)));
      return new Response(null, { status: 204 });
    }
    return Response.json([]);
  });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <StaffVenueProvider><TopUpsScreen /></StaffVenueProvider>
    </RivrDataProvider>,
  );
  return set;
}

describe('Top-ups (decision 0299)', () => {
  it('lists the waiting ones oldest first, the late one in red, and tonight’s closed ones below', async () => {
    renderTopUps();
    expect(await screen.findByText('Table 3, seat 5 · Kabir Sethi')).toBeDefined();
    expect(screen.getByText(/^Late \d\d:\d\d$/).className).toContain('bg-alert');
    expect(screen.getByText(/^00:[2-5]\d$/)).toBeDefined();
    expect(screen.getByText('Fulfilled in 1 min')).toBeDefined();
  });

  it('starts a top-up that was asked for, and finishes one in hand', async () => {
    const set = renderTopUps();
    fireEvent.click(await screen.findByRole('button', { name: 'The top-up for Kabir Sethi is in progress' }));
    fireEvent.click(screen.getByRole('button', { name: 'The top-up for Naina Kapoor is done' }));
    await waitFor(() => expect(set).toEqual([{ p_session_id: 's1', p_in_progress: true }, { p_session_id: 's2', p_in_progress: false }]));
  });
});
