import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY, type FloorTable, type SeatedPlayer } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MoveForm } from './MoveForm.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const TABLE: FloorTable = {
  id: 't3', venueId: 'v1', name: 'Table 3', room: 'main', seats: 6, tableTypeId: 'tt', tableTypeName: 'NLH 100/200', smallBlind: 10000n, bigBlind: 20000n,
  buyIn: 1000000n, straddle: null, waiting: 0, callTimeMinutes: 180, openSeats: null, mustMoveToTableId: null, isOpen: true,
};
const KABIR: SeatedPlayer = {
  sessionId: 's9', tableId: 't4', seat: 1, memberId: 'm9', fullName: 'Kabir Sethi', tierName: 'Gold', startedAt: '2026-11-15T15:00:00Z',
  mustMoveOrder: null, isAway: false, callTimeLeft: null, leavingAt: null, topUp: null,
};
/** A seated player's row as floor_seats gives it. */
const seated = (seat: number) => ({
  session_id: `s${String(seat)}`, table_id: 't3', seat, member_id: `m${String(seat)}`, full_name: `Player ${String(seat)}`, tier_name: 'Gold',
  started_at: '2026-11-15T15:00:00Z', must_move_order: null, away_since: null, call_time_left: null, leaving_at: null, top_up: null,
});

describe('MoveForm', () => {
  it('takes no seat that was taken after it was chosen (F2-17)', async () => {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000103', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
    const floor = { seats: [seated(2)] };
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
      const url = String(input instanceof Request ? input.url : input);
      return Response.json(url.includes('/rpc/floor_seats') ? floor.seats : []);
    });
    const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })} queryClient={cache}>
        <MoveForm venueId="v1" player={KABIR} tables={[TABLE]} onDone={() => undefined} onCancel={() => undefined} />
      </RivrDataProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Table 3' }));
    // Seat 2 is taken, so once the floor is read it is not offered.
    await waitFor(() => expect(screen.queryByRole('button', { name: '2' })).toBeNull(), { timeout: 5000 });
    fireEvent.click(screen.getByRole('button', { name: '4' }));
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Move' }).disabled).toBe(false);
    floor.seats = [seated(2), seated(4)];
    await act(() => cache.invalidateQueries());
    await waitFor(() => expect(screen.queryByRole('button', { name: '4' })).toBeNull(), { timeout: 5000 });
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Move' }).disabled).toBe(true);
  });
});
