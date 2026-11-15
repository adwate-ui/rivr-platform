import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY, type FloorTable, type WaitlistBoardEntry } from '@rivr/db';
import { ToastProvider } from '@rivr/ui';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WaitlistTable } from './WaitlistTable.tsx';
import { buildFloorTable, buildPlace } from './waitlistFixtures.ts';

const TABLE = buildFloorTable({ tableTypeName: 'NLH 50/100', smallBlind: 5000n, bigBlind: 10000n });
// A wait is counted in whole minutes, rounded up.
const FIVE_MINUTES_AGO = () => new Date(Date.now() - 4.5 * 60_000).toISOString();
const CALLED = { callTableName: 'Table 1', callSeat: 4, holdUntil: '2026-11-15T15:52:00Z' };

const place = (number: number, fullName: string, extra: Partial<WaitlistBoardEntry> = {}) =>
  buildPlace({ place: number, fullName, addedByFloor: true, joinedAt: FIVE_MINUTES_AGO(), ...extra });

/** A place as `waitlist_page` gives it. */
const rowOf = (entry: WaitlistBoardEntry, total: number) => ({
  total, entry_id: entry.entryId, table_type_id: entry.tableTypeId, member_id: entry.memberId, full_name: entry.fullName, joined_at: entry.joinedAt, place: entry.place,
  added_by_floor: entry.addedByFloor, priority_reason: entry.priorityReason, call_table_name: entry.callTableName, call_seat: entry.callSeat, hold_until: entry.holdUntil,
  away_until: entry.awayUntil, asked_table_id: entry.tableId, on_way_at: entry.onWayAt, needs_id_check: entry.needsIdCheck,
});

let calls: { rpc: string; body: unknown }[] = [];
let places: readonly WaitlistBoardEntry[] = [];

beforeEach(() => {
  calls = [];
  places = [place(1, 'Ishaan Verma'), place(2, 'Mihir Shah')];
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000103', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const rpc = String(input instanceof Request ? input.url : input).split('/rpc/')[1]?.split('?')[0];
    if (rpc === undefined) return Response.json([]);
    calls.push({ rpc, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    if (rpc === 'waitlist_page') return Response.json(places.map((entry) => rowOf(entry, 120)));
    return Response.json(rpc === 'list_choices' ? [{ column_key: 'table', value: 'Table 1', members: 118 }, { column_key: 'table', value: 'Table 4', members: 2 }] : null);
  });
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

interface Drawn { table?: FloorTable; cannotCheckId?: boolean }

/** The Waitlist's table over Table 1's list, with what Seat and Check ID were given. */
function renderTable({ table = TABLE, cannotCheckId = false }: Drawn = {}) {
  const onSeat = vi.fn();
  const onCheckId = vi.fn();
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ToastProvider place="console">
        <WaitlistTable venueId="v1" tables={[table]} onSeat={onSeat} onCheckId={cannotCheckId ? undefined : onCheckId} />
      </ToastProvider>
    </RivrDataProvider>,
  );
  return { onSeat, onCheckId };
}

const rowFor = async (name: string) => (await screen.findByText(name, {}, { timeout: 5000 })).closest<HTMLElement>('[role="row"]') ?? document.body;
const sent = (rpc: string) => calls.filter((call) => call.rpc === rpc).map((call) => call.body);

describe('the Waitlist as one table from the server (redesign RD-31)', () => {
  it('asks the server for a page of the places on every list, and shows each with its number, table, wait and what to know', async () => {
    renderTable();
    const row = await rowFor('Ishaan Verma');
    for (const shown of ['1', 'Table 1 · NLH 50/100', '5 min', 'By the floor']) expect(row.textContent).toContain(shown);
    expect(sent('waitlist_page')[0]).toMatchObject({ p_venue_id: 'v1', p_view: { page: 1, page_size: 50, query: '' } });
    // How many show of all, and the Table column's menu with the server's counts.
    expect(screen.getByText('2 of 120')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /^Table: sort and filter/ }));
    expect(await within(screen.getByRole('dialog', { name: 'Table: sort and filter' })).findByRole('button', { name: /^Table 1.*118/ })).toBeDefined();
  });

  it('holds a place from its menu, and Undo releases it through its own call', async () => {
    renderTable();
    fireEvent.click(within(await rowFor('Mihir Shah')).getByRole('button', { name: 'More for Mihir Shah' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Hold place' }));
    expect(await screen.findByText('Mihir Shah’s place held')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(sent('step_away')).toEqual([{ p_entry_id: 'e2', p_is_away: true }, { p_entry_id: 'e2', p_is_away: false }]));
  });

  it('asks before taking a place off the list, under its row', async () => {
    renderTable();
    fireEvent.click(within(await rowFor('Ishaan Verma')).getByRole('button', { name: 'More for Ishaan Verma' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Remove from list' }));
    expect(sent('leave_waitlist')).toEqual([]);
    fireEvent.click(await screen.findByRole('button', { name: 'Yes, remove Ishaan Verma' }));
    await waitFor(() => expect(sent('leave_waitlist')).toEqual([{ p_entry_id: 'e1' }]));
  });

  it('ticks places for the bulk bar, and opens the seat sheet from Seat with the place and its table', async () => {
    const { onSeat } = renderTable();
    fireEvent.click(within(await rowFor('Mihir Shah')).getByRole('checkbox', { name: 'Select Mihir Shah' }));
    expect(await screen.findByText('1 selected')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Seat Ishaan Verma' }));
    expect(onSeat).toHaveBeenCalledWith(expect.objectContaining({ entryId: 'e1' }), TABLE);
  });

  it('offers Call beside Seat for a member waiting with a seat free, and sends it (the owner, 8 Nov)', async () => {
    renderTable();
    fireEvent.click(within(await rowFor('Ishaan Verma')).getByRole('button', { name: 'Call Ishaan Verma' }));
    await waitFor(() => expect(sent('call_to_seat')).toHaveLength(1));
    expect(await screen.findByText('Ishaan Verma called')).toBeDefined();
  });

  it('offers no Call to a member called, away or needing an ID check; Check ID stands in for Seat, even once called (decision 0503)', async () => {
    places = [place(1, 'Uday Thakur', { needsIdCheck: true, ...CALLED }), place(2, 'Mihir Shah', CALLED), place(3, 'Naina Kapoor', { awayUntil: '2026-11-15T15:52:00Z' })];
    const { onSeat, onCheckId } = renderTable();
    const uday = await rowFor('Uday Thakur');
    expect(uday.textContent).toMatch(/ID check needed · .*seat 4.* · by the floor/);
    for (const name of ['Uday Thakur', 'Mihir Shah', 'Naina Kapoor']) expect(screen.queryByRole('button', { name: `Call ${name}` })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Seat Uday Thakur' })).toBeNull();
    fireEvent.click(within(uday).getByRole('button', { name: 'Check Uday Thakur’s ID' }));
    expect(onCheckId).toHaveBeenCalledWith(expect.objectContaining({ entryId: 'e1' }));
    // A member called opens the sheet for the seat held for them; nothing is sent from the row.
    fireEvent.click(screen.getByRole('button', { name: 'Seat Mihir Shah' }));
    expect(onSeat).toHaveBeenCalledOnce();
    expect(sent('seat_from_waitlist')).toEqual([]);
  });

  it('tells a cashier, who cannot check ID, who can, with no button that ends in a refusal (audit F-014)', async () => {
    places = [place(1, 'Uday Thakur', { needsIdCheck: true })];
    renderTable({ cannotCheckId: true });
    expect((await rowFor('Uday Thakur')).textContent).toMatch(/ID check needed.* · ask the floor or host/);
    expect(screen.queryByRole('button', { name: 'Check Uday Thakur’s ID' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Seat Uday Thakur' })).toBeNull();
  });

  it('offers no Seat or Call at a full or a closed table, but keeps Seat for a member called (audit F-030)', async () => {
    places = [place(1, 'Ishaan Verma'), place(2, 'Mihir Shah', CALLED)];
    renderTable({ table: { ...TABLE, openSeats: 0 } });
    await rowFor('Ishaan Verma');
    expect(screen.queryByRole('button', { name: 'Seat Ishaan Verma' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Call Ishaan Verma' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Seat Mihir Shah' })).toBeDefined();
    cleanup();
    places = [place(1, 'Ishaan Verma')];
    renderTable({ table: { ...TABLE, isOpen: false } });
    await rowFor('Ishaan Verma');
    expect(screen.queryByRole('button', { name: 'Call Ishaan Verma' })).toBeNull();
  });

  it('asks before holding a called place, as its call ends and the seat is freed', async () => {
    places = [place(1, 'Kabir Sethi', CALLED)];
    renderTable();
    fireEvent.click(within(await rowFor('Kabir Sethi')).getByRole('button', { name: 'More for Kabir Sethi' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Hold place' }));
    expect(await screen.findByText('Hold Kabir Sethi’s place? The seat is freed.')).toBeDefined();
    expect(sent('step_away')).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Yes, hold Kabir Sethi’s place' }));
    await waitFor(() => expect(sent('step_away')).toEqual([{ p_entry_id: 'e1', p_is_away: true }]));
    // No Undo: Release would not bring the call back.
    expect(await screen.findByText('Kabir Sethi’s place held')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
  });

  it('says nobody waits when no list holds a place', async () => {
    places = [];
    renderTable();
    expect(await screen.findByText('No one is waiting.', {}, { timeout: 5000 })).toBeDefined();
  });
});
