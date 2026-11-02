import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY, type FloorTable, type SeatedPlayer } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SeatForm } from './SeatForm.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const TABLE: FloorTable = {
  id: 't3', venueId: 'v1', name: 'Table 3', room: 'main', seats: 6, tableTypeId: 'tt', tableTypeName: 'NLH 100/200', game: 'nlh', smallBlind: 10000n, bigBlind: 20000n,
  buyIn: 1000000n, straddle: null, waiting: 0, callTimeMinutes: 180, openSeats: null, mustMoveToTableId: null, isOpen: true,
};
const TAKEN: SeatedPlayer = {
  sessionId: 's1', tableId: 't3', seat: 4, memberId: 'm1', fullName: 'Kabir Sethi', tierName: 'Gold', startedAt: '2026-11-15T15:00:00Z',
  mustMoveOrder: null, isAway: false, callTimeLeft: null, leavingAt: null, topUp: null, timeRequest: null,
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

  it('seats by membership number or by mobile number, with the call time chosen (decision 0299)', async () => {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
      access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: '00000000-0000-4000-8000-000000000103', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
    }));
    const sent: unknown[] = [];
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input instanceof Request ? input.url : input).includes('/rpc/seat_member')) sent.push(JSON.parse(String(init?.body)));
      return Response.json([]);
    });
    render(
      <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
        queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <SeatForm venueId="v1" table={TABLE} seats={[]} held={[]} onResult={() => undefined} />
      </RivrDataProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    fireEvent.click(screen.getByRole('button', { name: '5 h' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Mobile or member number' }), { target: { value: '1042' } });
    fireEvent.click(screen.getByRole('button', { name: 'Seat' }));
    await waitFor(() => expect(sent).toEqual([{ p_table_id: 't3', p_seat: 2, p_member_number: 1042, p_call_minutes: 300 }]));

    fireEvent.click(screen.getByRole('button', { name: '3' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Mobile or member number' }), { target: { value: '98110 00001' } });
    fireEvent.click(screen.getByRole('button', { name: 'Seat' }));
    await waitFor(() => expect(sent[1]).toEqual({ p_table_id: 't3', p_seat: 3, p_phone: '+919811000001', p_call_minutes: 300 }));
  });
});
