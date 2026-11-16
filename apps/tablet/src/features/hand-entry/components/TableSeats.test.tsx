import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TableSeats } from './TableSeats.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const OPEN = { seat: 1, session_id: null, member_id: null, full_name: null, away_since: null, minimum_paise: 1000000, call_time_left: null, leaving_at: null, small_blind_paise: 10000, big_blind_paise: 20000, straddle_paise: null };
const LEAVING = { ...OPEN, seat: 9, session_id: 's9', member_id: 'm9', full_name: 'Yash Gupta', leaving_at: '2026-11-15T18:05:00+00:00' };

/** Tablet A at Private Room, whose table type's name is not its stake. */
function renderSeats(isFnbOff = false) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-00000000e001', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/rpc/my_device')) return Response.json([{ device_id: 'd1', venue_id: 'v1', name: 'Tablet A', kind: 'dealer_tablet', table_id: 't3', table_name: 'Private Room', is_practice: false }]);
    if (url.includes('/rpc/tablet_seats')) return Response.json([OPEN, LEAVING]);
    if (url.includes('/rpc/fnb_on')) return Response.json(!isFnbOff);
    return Response.json([]);
  });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <TableSeats />
    </RivrDataProvider>,
  );
}

describe('the ring on the tablet (F-189)', () => {
  it('shows the blinds on the felt and who to watch on the seat', async () => {
    renderSeats();
    expect(await screen.findByText('100/200', {}, { timeout: 5000 })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Seat 9, Yash Gupta, Leaving' })).toBeDefined();
    expect(screen.getByText('Leaving')).toBeDefined();
  });
});

describe('food and drink for a seat on the tablet (decision 0681)', () => {
  it('offers the seat Food and drink, and none while a super admin has it off', async () => {
    renderSeats();
    fireEvent.click(await screen.findByRole('button', { name: 'Seat 9, Yash Gupta, Leaving' }, { timeout: 5000 }));
    expect(await screen.findByRole('button', { name: 'Food and drink' })).toBeDefined();
    cleanup();
    renderSeats(true);
    fireEvent.click(await screen.findByRole('button', { name: 'Seat 9, Yash Gupta, Leaving' }, { timeout: 5000 }));
    expect(await screen.findByText('Food and drink is off.')).toBeDefined();
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Food and drink' })).toBeNull());
  });
});
