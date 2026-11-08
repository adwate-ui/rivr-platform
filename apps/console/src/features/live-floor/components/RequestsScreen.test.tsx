import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NOW, renderFloorScreen, requestRow, seatRow, tableRow } from './floorTestApi.tsx';
import { RequestsScreen } from './RequestsScreen.tsx';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const API = {
  tables: [tableRow('t1', 'Table 1')],
  seats: [seatRow({ session: 's2', table: 't1', seat: 5, name: 'Kabir Sethi', time: { id: 'r1', minutes: 60 } })],
  requests: [requestRow({ kind: 'time', id: 'r1', name: 'Kabir Sethi', minutes: 7, session_id: 's2', table_id: 't1', seat: 5, asked: 60, call_time_left: 600 })],
  queues: [{ queue: 'kycReview', waiting: 2 }, { queue: 'feedback', waiting: 4 }],
};

/** A place on Table 1's list, not called, at `place`. */
function boardRow(entry: string, name: string, place: number) {
  return {
    entry_id: entry, table_type_id: 'tt2', member_id: `m-${entry}`, full_name: name, joined_at: '2026-11-15T16:00:00Z', place, added_by_floor: false,
    priority_reason: null, call_table_name: null, call_seat: null, hold_until: null, away_until: null, asked_table_id: 't1', on_way_at: null, needs_id_check: false,
  };
}

/**
 * Approved players not yet seated: Leela with a seat free for her (fifth on the list), Arjun called to seat 4, Dev with
 * his identity check unfinished, Mira at a full table for 40 minutes.
 */
const APPROVED = {
  tables: [tableRow('t1', 'Table 1'), tableRow('t4', 'Table 4', { is_open: false })],
  // Arjun, once seated at the seat held for him: the session Undo takes back.
  seats: [seatRow({ session: 'e6', table: 't1', seat: 4, name: 'Arjun Rao' })],
  requests: [
    requestRow({ kind: 'seat', id: 'e5', name: 'Leela Menon', minutes: 9, table_id: 't1' }),
    requestRow({ kind: 'seat', id: 'e6', name: 'Arjun Rao', minutes: 8, table_id: 't1', seat: 4 }),
    requestRow({ kind: 'seat_check', id: 'e7', name: 'Dev Khanna', minutes: 7, table_id: 't1' }),
    requestRow({ kind: 'seat_wait', id: 'e8', name: 'Mira Shah', minutes: 40, table_id: 't1' }),
    requestRow({ kind: 'seat_wait', id: 'e9', name: 'Priya Nair', minutes: 5, table_id: 't4' }),
  ],
  board: [boardRow('e1', 'Anya Das', 1), boardRow('e2', 'Bela Roy', 2), boardRow('e3', 'Chirag Jain', 3), boardRow('e4', 'Dia Sen', 4), boardRow('e5', 'Leela Menon', 5)],
};

/** The radio for a name on the seat sheet's list, chosen or not. */
const chosen = (sheet: HTMLElement, name: RegExp) => within(sheet).getByRole('radio', { name }).getAttribute('aria-checked');

describe('Seating an approved player (the owner, 8 Nov)', () => {
  it('lists each approved player until seated: to seat, their ID check first, or waiting for a seat, never late', async () => {
    renderFloorScreen(RequestsScreen, APPROVED);
    expect(await screen.findByText('Table 1, seat 4 held', {}, { timeout: 5000 })).toBeDefined();
    expect(screen.getAllByText('To seat')).toHaveLength(2);
    expect(screen.getByText('ID check, then seat')).toBeDefined();
    expect(screen.getAllByText('Waiting for a seat')).toHaveLength(2);
    expect(screen.getByText('Table 1 is full')).toBeDefined();
    expect(screen.getByText('Table 4 is not open')).toBeDefined();
    // Their wait counts from approval or call; the alert itself tells the floor, so none shows late.
    expect(screen.getByText('9 min').className).not.toContain('text-danger');
    expect(screen.getByText('40 min').className).not.toContain('text-danger');
  });

  it('seats one called at the seat held for him, and opens the seat sheet with one a seat is free for', async () => {
    const { rpcs } = renderFloorScreen(RequestsScreen, APPROVED);
    await screen.findByText('Table 1, seat 4 held', {}, { timeout: 5000 });
    const [forLeela, forArjun] = screen.getAllByRole('button', { name: 'Seat' });
    if (forLeela === undefined || forArjun === undefined) throw new Error('Two Seat buttons expected');
    fireEvent.click(forArjun);
    await waitFor(() => expect(rpcs('seat_from_waitlist')).toEqual([{ p_entry_id: 'e6' }]));
    // Seated with Undo, which takes the seat back (decision 0480).
    fireEvent.click(await screen.findByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(rpcs('undo_seat')).toEqual([{ p_session_id: 'e6' }]));
    fireEvent.click(forLeela);
    const sheet = await screen.findByRole('dialog', { name: 'Seat a player' });
    await waitFor(() => expect(chosen(sheet, /^Leela Menon/)).toBe('true'));
    expect(chosen(sheet, /^Anya Das/)).toBe('false');
  });

  it('opens the check in person, the member searched, for one whose identity check is unfinished (decision 0503)', async () => {
    const { router } = renderFloorScreen(RequestsScreen, APPROVED);
    fireEvent.click(await screen.findByRole('button', { name: 'Check ID' }, { timeout: 5000 }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/kyc-review'));
    expect(router.state.location.search).toEqual({ check: 'Dev Khanna' });
  });

  it('opens the seat sheet with the player chosen once Approve goes through and a seat is free', async () => {
    const api: { tables: unknown[]; requests: unknown[]; board: unknown[] } = {
      tables: [tableRow('t1', 'Table 1')], requests: [requestRow({ kind: 'join', id: 'e5', name: 'Leela Menon', minutes: 2, table_id: 't1' })], board: [],
    };
    renderFloorScreen(RequestsScreen, api);
    const approve = await screen.findByRole('button', { name: 'Approve' }, { timeout: 5000 });
    api.requests = [requestRow({ kind: 'seat', id: 'e5', name: 'Leela Menon', minutes: 0, table_id: 't1' })];
    api.board = [boardRow('e5', 'Leela Menon', 1)];
    fireEvent.click(approve);
    const sheet = await screen.findByRole('dialog', { name: 'Seat a player' });
    await waitFor(() => expect(chosen(sheet, /^Leela Menon/)).toBe('true'));
  });

  it('leaves the alert waiting, with no sheet, when the table is full', async () => {
    const api: { tables: unknown[]; requests: unknown[] } = {
      tables: [tableRow('t1', 'Table 1')], requests: [requestRow({ kind: 'join', id: 'e5', name: 'Leela Menon', minutes: 2, table_id: 't1' })],
    };
    renderFloorScreen(RequestsScreen, api);
    const approve = await screen.findByRole('button', { name: 'Approve' }, { timeout: 5000 });
    api.requests = [requestRow({ kind: 'seat_wait', id: 'e5', name: 'Leela Menon', minutes: 0, table_id: 't1' })];
    fireEvent.click(approve);
    expect(await screen.findByText('Waiting for a seat')).toBeDefined();
    expect(screen.queryByRole('dialog', { name: 'Seat a player' })).toBeNull();
  });
});

describe('Requests on a phone (console v3)', () => {
  it('lists the floor\'s requests as a screen, late in danger, with what else waits below', async () => {
    renderFloorScreen(RequestsScreen, API);
    expect(await screen.findByRole('heading', { name: 'Requests' }, { timeout: 5000 })).toBeDefined();
    expect(await screen.findByText('Wants +1 h')).toBeDefined();
    expect(screen.getByText('Table 1, seat 5 · 10 min left')).toBeDefined();
    expect(screen.getByText('Late · 7 min').className).toContain('text-danger');
    expect(await screen.findByText('Also waiting')).toBeDefined();
    expect(screen.getByRole('button', { name: /KYC checks/ })).toBeDefined();
    expect(screen.queryByText('Spins to do')).toBeNull();
  });

  it('approves more time with Undo, which calls the database\'s undo', async () => {
    const { rpcs } = renderFloorScreen(RequestsScreen, API);
    fireEvent.click(await screen.findByRole('button', { name: 'Approve' }, { timeout: 5000 }));
    await screen.findByText('Kabir Sethi: +1 h approved');
    expect(rpcs('decide_call_time_request')).toEqual([{ p_request_id: 'r1', p_is_approved: true }]);
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(rpcs('undo_call_time')).toEqual([{ p_request_id: 'r1' }]));
  });

  it('opens the player\'s sheet from their name', async () => {
    renderFloorScreen(RequestsScreen, API);
    fireEvent.click(await screen.findByRole('button', { name: 'Kabir Sethi' }, { timeout: 5000 }));
    expect(await screen.findByRole('dialog', { name: 'Kabir Sethi' })).toBeDefined();
  });

  it('has nothing for staff who are not the floor', async () => {
    renderFloorScreen(RequestsScreen, { ...API, role: 'marketing' });
    expect(await screen.findByText('All clear.', {}, { timeout: 5000 })).toBeDefined();
  });
});
