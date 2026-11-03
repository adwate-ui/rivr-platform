import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY, type FloorTable, type WaitlistBoardEntry, type WaitlistRequest } from '@rivr/db';
import { ToastProvider } from '@rivr/ui';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TableWaitlist } from './TableWaitlist.tsx';

const NOW = new Date('2026-11-15T15:40:00Z');

const TABLE: FloorTable = {
  id: 't1', venueId: 'v1', name: 'Table 1', room: 'main', seats: 9, tableTypeId: 'tt', tableTypeName: 'NLH 50/100', game: 'nlh', smallBlind: 5000n,
  bigBlind: 10000n, buyIn: 500000n, straddle: null, waiting: 2, callTimeMinutes: 180, openSeats: 3, mustMoveToTableId: null, isOpen: true,
};

const place = (place: number, fullName: string, extra: Partial<WaitlistBoardEntry> = {}): WaitlistBoardEntry => ({
  entryId: `e${String(place)}`, tableTypeId: 'tt', memberId: `m${String(place)}`, fullName, joinedAt: '2026-11-15T15:35:00Z', place, addedByFloor: true,
  priorityReason: null, callTableName: null, callSeat: null, holdUntil: null, awayUntil: null, tableId: 't1', onWayAt: null, ...extra,
});

const REQUEST: WaitlistRequest = { entryId: 'r1', memberId: 'm9', fullName: 'Ritika Bhalla', joinedAt: '2026-11-15T15:36:00Z', tableTypeId: 'tt', tableId: 't1' };

let calls: { rpc: string; body: unknown }[] = [];

beforeEach(() => {
  calls = [];
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000103', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    const rpc = url.split('/rpc/')[1];
    if (rpc !== undefined) calls.push({ rpc, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    return Response.json(rpc === undefined ? [] : null);
  });
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

function renderCard(props: { entries?: readonly WaitlistBoardEntry[]; ticked?: ReadonlySet<string>; onToggle?: (id: string) => void; onSeat?: () => void }) {
  return render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ToastProvider place="console">
        <TableWaitlist venueId="v1" table={TABLE} entries={props.entries ?? [place(1, 'Ishaan Verma'), place(2, 'Mihir Shah')]} requests={[REQUEST]}
          interest={undefined} canOpen now={NOW} ticked={props.ticked ?? new Set()} onToggle={props.onToggle ?? vi.fn()} onSeat={props.onSeat ?? vi.fn()} />
      </ToastProvider>
    </RivrDataProvider>,
  );
}

describe("a table's waitlist card (console v3)", () => {
  it('names the table, its stake and open seats, the join asking, and each place in order with how long it has waited', () => {
    renderCard({});
    const card = screen.getByRole('heading', { level: 2, name: 'Table 1' }).closest('section') ?? document.body;
    expect(within(card).getByText('NLH 50/100 · 3 open')).toBeDefined();
    expect(within(card).getByText('asks to join')).toBeDefined();
    expect(within(card).getAllByText('5 min · added by the floor')).toHaveLength(2);
    expect(within(card).getByRole('button', { name: 'Seat Ishaan Verma' })).toBeDefined();
  });

  it('approves a join onto the list and says so', async () => {
    renderCard({});
    fireEvent.click(screen.getByRole('button', { name: 'Approve Ritika Bhalla' }));
    await waitFor(() => expect(calls).toContainEqual({ rpc: 'approve_waitlist_request', body: { p_entry_id: 'r1' } }));
    expect(await screen.findByText('Ritika Bhalla added to the Table 1 list')).toBeDefined();
  });

  it('declines a join, which takes the request off', async () => {
    renderCard({});
    fireEvent.click(screen.getByRole('button', { name: 'Decline Ritika Bhalla' }));
    await waitFor(() => expect(calls).toContainEqual({ rpc: 'leave_waitlist', body: { p_entry_id: 'r1' } }));
    expect(await screen.findByText('Ritika Bhalla’s request declined')).toBeDefined();
  });

  it('holds a place from its menu, and Undo releases it through its own call', async () => {
    renderCard({});
    fireEvent.click(screen.getByRole('button', { name: 'More for Mihir Shah' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Hold place' }));
    expect(await screen.findByText('Mihir Shah’s place held')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(calls.filter((call) => call.rpc === 'step_away').map((call) => call.body)).toEqual([
      { p_entry_id: 'e2', p_is_away: true }, { p_entry_id: 'e2', p_is_away: false },
    ]));
  });

  it('asks before taking a place off the list', async () => {
    renderCard({});
    fireEvent.click(screen.getByRole('button', { name: 'More for Ishaan Verma' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Remove from list' }));
    expect(calls.filter((call) => call.rpc === 'leave_waitlist')).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Yes, remove Ishaan Verma' }));
    await waitFor(() => expect(calls).toContainEqual({ rpc: 'leave_waitlist', body: { p_entry_id: 'e1' } }));
  });

  it('ticks a place for the bulk bar, and opens the seat sheet from Seat', () => {
    const onToggle = vi.fn();
    const onSeat = vi.fn();
    renderCard({ onToggle, onSeat, ticked: new Set(['e2']) });
    expect(screen.getByRole('checkbox', { name: 'Select Mihir Shah' })).toHaveProperty('checked', true);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Ishaan Verma' }));
    fireEvent.click(screen.getByRole('button', { name: 'Seat Ishaan Verma' }));
    expect(onToggle).toHaveBeenCalledWith('e1');
    expect(onSeat).toHaveBeenCalledOnce();
  });

  it('seats a called member at the seat held for them, with no sheet', async () => {
    const onSeat = vi.fn();
    renderCard({ onSeat, entries: [place(1, 'Kabir Sethi', { callTableName: 'Table 1', callSeat: 4, holdUntil: '2026-11-15T15:52:00Z' })] });
    fireEvent.click(screen.getByRole('button', { name: 'Seat Kabir Sethi' }));
    await waitFor(() => expect(calls).toContainEqual({ rpc: 'seat_from_waitlist', body: { p_entry_id: 'e1' } }));
    expect(onSeat).not.toHaveBeenCalled();
    expect(await screen.findByText('Kabir Sethi seated at Table 1, seat 4')).toBeDefined();
  });

  it('says nobody waits when the list is empty', () => {
    renderCard({ entries: [] });
    expect(screen.getByText('No one is waiting.')).toBeDefined();
  });
});
