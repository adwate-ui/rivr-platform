import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY, type FloorTable, type SeatedPlayer } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SeatForm } from './SeatForm.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const TABLE: FloorTable = {
  id: 't3', venueId: 'v1', name: 'Table 3', room: 'main', seats: 6, tableTypeId: 'tt', tableTypeName: 'NLH 100/200', smallBlind: 10000n, bigBlind: 20000n,
  buyIn: 1000000n, straddle: null, waiting: 0, callTimeMinutes: 180, openSeats: null, mustMoveToTableId: null, isOpen: true,
};
const TAKEN: SeatedPlayer = {
  sessionId: 's1', tableId: 't3', seat: 4, memberId: 'm1', fullName: 'Kabir Sethi', tierName: 'Gold', startedAt: '2026-11-15T15:00:00Z',
  mustMoveOrder: null, isAway: false, callTimeLeft: null, leavingAt: null, topUp: null,
};

describe('SeatForm', () => {
  it('takes no seat that was taken after it was chosen (F2-17)', () => {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000103', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
    vi.stubGlobal('fetch', async () => Response.json([]));
    const form = (seats: readonly SeatedPlayer[]) => (
      <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
        queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <SeatForm venueId="v1" table={TABLE} seats={seats} held={[]} onResult={() => undefined} />
      </RivrDataProvider>
    );
    const { rerender } = render(form([]));
    fireEvent.click(screen.getByRole('button', { name: '4' }));
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Seat' }).disabled).toBe(false);
    rerender(form([TAKEN]));
    expect(screen.queryByRole('button', { name: '4' })).toBeNull();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Seat' }).disabled).toBe(true);
  });
});
