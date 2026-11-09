import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY, type FloorTable, type WaitlistBoardEntry, type WaitlistRequest } from '@rivr/db';
import { ToastProvider } from '@rivr/ui';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TableWaitlist } from './TableWaitlist.tsx';
import { buildFloorTable, buildPlace } from './waitlistFixtures.ts';

const NOW = new Date('2026-11-15T15:40:00Z');

const TABLE = buildFloorTable({ tableTypeName: 'NLH 50/100', smallBlind: 5000n, bigBlind: 10000n });

const place = (number: number, fullName: string, extra: Partial<WaitlistBoardEntry> = {}) => buildPlace({ place: number, fullName, addedByFloor: true, ...extra });

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

function renderCard(props: {
  entries?: readonly WaitlistBoardEntry[]; ticked?: ReadonlySet<string>; onToggle?: (id: string) => void; onSeat?: () => void;
  onCheckId?: (entry: WaitlistBoardEntry) => void; onApproved?: (entryId: string) => void; cannotCheckId?: boolean; table?: FloorTable;
}) {
  return render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ToastProvider place="console">
        <TableWaitlist venueId="v1" table={props.table ?? TABLE} entries={props.entries ?? [place(1, 'Ishaan Verma'), place(2, 'Mihir Shah')]} requests={[REQUEST]}
          interest={undefined} canOpen now={NOW} ticked={props.ticked ?? new Set()} onToggle={props.onToggle ?? vi.fn()} onSeat={props.onSeat ?? vi.fn()}
          onApproved={props.onApproved ?? vi.fn()} onCheckId={props.cannotCheckId === true ? undefined : props.onCheckId ?? vi.fn()} />
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

  it('approves a join onto the list, says so, and leads on to seating them (the owner, 8 Nov)', async () => {
    const onApproved = vi.fn();
    renderCard({ onApproved });
    fireEvent.click(screen.getByRole('button', { name: 'Approve Ritika Bhalla' }));
    await waitFor(() => expect(calls).toContainEqual({ rpc: 'approve_waitlist_request', body: { p_entry_id: 'r1' } }));
    expect(await screen.findByText('Ritika Bhalla added to the Table 1 list')).toBeDefined();
    expect(onApproved).toHaveBeenCalledWith('r1');
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

  it('tells a cashier, who cannot check ID, who can, with no button that ends in a refusal (audit F-014)', () => {
    renderCard({ cannotCheckId: true, entries: [place(1, 'Uday Thakur', { needsIdCheck: true }), place(2, 'Mihir Shah')] });
    expect(screen.getByText(/ID check needed.* · ask the floor or host$/)).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Check Uday Thakur’s ID' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Seat Uday Thakur' })).toBeNull();
  });

  it('offers Call beside Seat for a member waiting with a seat free, and sends it (the owner, 8 Nov)', async () => {
    renderCard({ entries: [place(1, 'Ishaan Verma')] });
    fireEvent.click(screen.getByRole('button', { name: 'Call Ishaan Verma' }));
    await waitFor(() => expect(calls.filter((call) => call.rpc === 'call_to_seat')).toHaveLength(1));
    expect(await screen.findByText('Ishaan Verma called')).toBeDefined();
  });

  it('offers no Call to a member already called or needing an ID check', () => {
    renderCard({ entries: [place(1, 'Uday Thakur', { needsIdCheck: true }), place(2, 'Mihir Shah', { callTableName: 'Table 1', callSeat: 4, holdUntil: '2026-11-15T15:52:00Z' })] });
    expect(screen.queryByRole('button', { name: 'Call Uday Thakur' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Call Mihir Shah' })).toBeNull();
  });

  it('says a full table is full, with no Seat or Call on its rows, but keeps Seat for a member called (audit F-030)', () => {
    renderCard({ table: { ...TABLE, openSeats: 0 }, entries: [place(1, 'Ishaan Verma'), place(2, 'Mihir Shah', { callTableName: 'Table 1', callSeat: 4, holdUntil: '2026-11-15T15:52:00Z' })] });
    expect(screen.getByText('Full. Seat when a seat frees.')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Seat Ishaan Verma' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Call Ishaan Verma' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Seat Mihir Shah' })).toBeDefined();
  });

  it('marks a place whose ID the desk must check, and offers Check ID in place of Seat, even once called (decision 0503)', () => {
    const onSeat = vi.fn();
    const onCheckId = vi.fn();
    const uday = place(1, 'Uday Thakur', { needsIdCheck: true, callTableName: 'Table 1', callSeat: 4, holdUntil: '2026-11-15T15:52:00Z' });
    renderCard({ onSeat, onCheckId, entries: [uday, place(2, 'Mihir Shah')] });
    expect(screen.getByText(/^5 min · ID check needed · .*seat 4.* · added by the floor/)).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Seat Uday Thakur' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Check Uday Thakur’s ID' }));
    expect(onCheckId).toHaveBeenCalledWith(uday);
    expect(onSeat).not.toHaveBeenCalled();
    expect(calls.filter((call) => call.rpc === 'seat_from_waitlist')).toEqual([]);
    // A verified member keeps Seat.
    expect(screen.getByRole('button', { name: 'Seat Mihir Shah' })).toBeDefined();
  });

  it('opens the sheet for a called member, for their held seat, a call time and any bonus chips', () => {
    const onSeat = vi.fn();
    renderCard({ onSeat, entries: [place(1, 'Kabir Sethi', { callTableName: 'Table 1', callSeat: 4, holdUntil: '2026-11-15T15:52:00Z' })] });
    fireEvent.click(screen.getByRole('button', { name: 'Seat Kabir Sethi' }));
    expect(onSeat).toHaveBeenCalledOnce();
    expect(calls.filter((call) => call.rpc === 'seat_from_waitlist')).toEqual([]);
  });

  it('offers no Call to a member away, or at a closed table', () => {
    renderCard({ entries: [place(1, 'Naina Kapoor', { awayUntil: '2026-11-15T15:52:00Z' })] });
    expect(screen.queryByRole('button', { name: 'Call Naina Kapoor' })).toBeNull();
    cleanup();
    renderCard({ table: { ...TABLE, isOpen: false }, entries: [place(1, 'Ishaan Verma')] });
    expect(screen.queryByRole('button', { name: 'Call Ishaan Verma' })).toBeNull();
  });

  it('asks before holding a called place, as its call ends and the seat is freed', async () => {
    renderCard({ entries: [place(1, 'Kabir Sethi', { callTableName: 'Table 1', callSeat: 4, holdUntil: '2026-11-15T15:52:00Z' })] });
    fireEvent.click(screen.getByRole('button', { name: 'More for Kabir Sethi' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Hold place' }));
    expect(screen.getByText('Hold Kabir Sethi’s place? The seat is freed.')).toBeDefined();
    expect(calls.filter((call) => call.rpc === 'step_away')).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Yes, hold Kabir Sethi’s place' }));
    await waitFor(() => expect(calls).toContainEqual({ rpc: 'step_away', body: { p_entry_id: 'e1', p_is_away: true } }));
    // No Undo: Release would not bring the call back.
    expect(await screen.findByText('Kabir Sethi’s place held')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
  });

  it('says nobody waits when the list is empty', () => {
    renderCard({ entries: [] });
    expect(screen.getByText('No one is waiting.')).toBeDefined();
  });
});
