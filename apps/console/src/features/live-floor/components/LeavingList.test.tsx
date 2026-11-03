import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY, type FloorTable, type SeatedPlayer } from '@rivr/db';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LeavingList } from './LeavingList.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const TABLE: Omit<FloorTable, 'id' | 'name' | 'room'> = {
  venueId: 'v1', seats: 9, tableTypeId: 'tt', tableTypeName: 'NLH 100/200', game: 'nlh', smallBlind: 10000n, bigBlind: 20000n, buyIn: 1000000n,
  straddle: null, waiting: 0, callTimeMinutes: 180, openSeats: null, mustMoveToTableId: null, isOpen: true,
};
const TABLES: FloorTable[] = [{ ...TABLE, id: 't3', name: 'Table 3', room: 'main' }, { ...TABLE, id: 'pr', name: 'Private Room', room: 'private' }];
const PLAYER: SeatedPlayer = {
  sessionId: 's1', tableId: 't3', seat: 5, memberId: 'm1', fullName: 'Kabir Sethi', tierName: 'Gold', startedAt: '2026-11-15T15:00:00Z',
  mustMoveOrder: null, isAway: false, callTimeLeft: 1500, leavingAt: '2026-11-15T16:00:00Z', topUp: null, timeRequest: null,
};
const SEATS: SeatedPlayer[] = [
  PLAYER,
  { ...PLAYER, sessionId: 's2', tableId: 'pr', seat: 1, memberId: 'm2', fullName: 'Ishaan Verma', callTimeLeft: 300 },
  { ...PLAYER, sessionId: 's3', seat: 2, memberId: 'm3', fullName: 'Rohan Bhatia', leavingAt: null },
];

/** Aditya, the floor, signed in, and a fake API that records what is sent to set_leaving, end_seat and let_leave_early. */
function renderList(seats: SeatedPlayer[], canLetGoEarly = false) {
  localStorage.setItem(
    SESSION_STORAGE_KEY,
    JSON.stringify({
      access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: '00000000-0000-4000-8000-000000000103', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
    }),
  );
  const sent: unknown[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/rpc/set_leaving') || url.includes('/rpc/end_seat') || url.includes('/rpc/let_leave_early')) {
      sent.push(JSON.parse(String(init?.body)));
      return new Response(null, { status: 204 });
    }
    return Response.json([]);
  });
  const client = createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' });
  const view = render(
    <RivrDataProvider client={client}><LeavingList venueId="v1" tables={TABLES} seats={seats} isFloor canLetGoEarly={canLetGoEarly} /></RivrDataProvider>,
  );
  return { sent, view };
}

describe('LeavingList (decision 0163)', () => {
  it('lets the floor free the seat of a player whose call time is done', async () => {
    const { sent } = renderList([{ ...PLAYER, callTimeLeft: 0 }]);
    fireEvent.click(screen.getByRole('button', { name: 'Let Kabir Sethi go from the leaving list' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, Kabir Sethi leaves' }));
    await waitFor(() => expect(sent).toEqual([{ p_session_id: 's1', p_reason: 'left' }]));
  });

  it('lets staff with the override let one who still owes call time go early, with a reason (decision 0306)', async () => {
    const { sent } = renderList([PLAYER], true);
    fireEvent.click(screen.getByRole('button', { name: 'Let Kabir Sethi go from the leaving list' }));
    expect(screen.getByRole('heading', { name: 'Early departure for Kabir Sethi' })).toBeDefined();
    fireEvent.change(screen.getByLabelText(/Why they leave early/), { target: { value: 'Family emergency' } });
    fireEvent.click(screen.getByRole('button', { name: 'Let leave early' }));
    await waitFor(() => expect(sent).toEqual([{ p_venue_id: 'v1', p_member_id: 'm1', p_reason: 'Family emergency' }, { p_session_id: 's1', p_reason: 'left' }]));
  });

  it('lets other floor staff free the seat of one who still owes, who then leaves owing (decision 0306)', async () => {
    const { sent } = renderList([PLAYER]);
    fireEvent.click(screen.getByRole('button', { name: 'Let Kabir Sethi go from the leaving list' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, Kabir Sethi leaves' }));
    await waitFor(() => expect(sent).toEqual([{ p_session_id: 's1', p_reason: 'left' }]));
  });

  it('lists the players marked leaving, the soonest seat first, with the call time each still owes', () => {
    renderList(SEATS);
    expect(screen.getByRole('heading', { name: 'Leaving' })).toBeDefined();
    const names = screen.getAllByText(/^(Kabir Sethi|Ishaan Verma|Rohan Bhatia)$/).map((name) => name.textContent);
    expect(names).toEqual(['Ishaan Verma', 'Kabir Sethi']);
    expect(screen.getByText('Private Room · seat 1')).toBeDefined();
    expect(screen.getByText('Call time 25 min left')).toBeDefined();
  });

  it('takes a leaving back', async () => {
    const { sent } = renderList(SEATS);
    fireEvent.click(screen.getByRole('button', { name: 'Kabir Sethi is not leaving' }));
    await waitFor(() => expect(sent).toEqual([{ p_session_id: 's1', p_is_leaving: false }]));
  });

  it('shows nothing when nobody is leaving', () => {
    const { view } = renderList([{ ...PLAYER, leavingAt: null }]);
    expect(view.container.innerHTML).toBe('');
  });
});
