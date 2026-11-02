import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY, type FloorTable } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AssignForm } from './AssignForm.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const TABLE: FloorTable = {
  id: 't3', venueId: 'v1', name: 'Table 3', room: 'main', seats: 6, tableTypeId: 'tt', tableTypeName: 'NLH 100/200', game: 'nlh', smallBlind: 10000n, bigBlind: 20000n,
  buyIn: 1000000n, straddle: null, waiting: 0, callTimeMinutes: 180, openSeats: null, mustMoveToTableId: null, isOpen: true,
};
/** A seated player's row as floor_seats gives it. */
const seated = (seat: number) => ({
  session_id: `s${String(seat)}`, table_id: 't3', seat, member_id: `m${String(seat)}`, full_name: `Player ${String(seat)}`, tier_name: 'Gold',
  started_at: '2026-11-15T15:00:00Z', must_move_order: null, away_since: null, call_time_left: null, leaving_at: null, top_up: null,
});

describe('AssignForm', () => {
  it('offers only the seats neither taken nor held, and calls to none taken after it was chosen (F2-18)', async () => {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000103', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
    const floor = { seats: [seated(2)] };
    const calls: unknown[] = [];
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input instanceof Request ? input.url : input);
      if (url.includes('/rpc/floor_seats')) return Response.json(floor.seats);
      if (url.includes('/rpc/held_seats')) return Response.json([{ table_id: 't3', seat: 5, full_name: 'Naina Kapoor' }]);
      if (url.includes('/rpc/assign_from_waitlist')) calls.push(JSON.parse(String(init?.body)));
      return Response.json([]);
    });
    const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })} queryClient={cache}>
        <AssignForm venueId="v1" entryId="e1" name="Naina Kapoor" tables={[TABLE]} onDone={() => undefined} />
      </RivrDataProvider>,
    );
    await waitFor(() => expect(screen.queryByRole('button', { name: '5' })).toBeNull(), { timeout: 5000 });
    expect(screen.queryByRole('button', { name: '2' })).toBeNull();
    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual(expect.arrayContaining(['1', '3', '4', '6']));
    fireEvent.click(screen.getByRole('button', { name: '4' }));
    floor.seats = [seated(2), seated(4)];
    await act(() => cache.invalidateQueries());
    await waitFor(() => expect(screen.queryByRole('button', { name: '4' })).toBeNull(), { timeout: 5000 });
    fireEvent.click(screen.getByRole('button', { name: 'Assign' }));
    expect(await screen.findByText('Choose an open table, a seat at it, and a call time of 0 to 1,440 minutes.')).toBeDefined();
    expect(calls).toEqual([]);

    // A free seat and four hours: assigned, and seated at once (decision 0299).
    fireEvent.click(screen.getByRole('button', { name: '6' }));
    fireEvent.click(screen.getByRole('button', { name: '4 h' }));
    fireEvent.click(screen.getByRole('button', { name: 'Assign' }));
    await waitFor(() => expect(calls).toEqual([{ p_entry_id: 'e1', p_table_id: 't3', p_seat: 6, p_call_minutes: 240 }]));
  });
});
