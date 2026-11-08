import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NOW, renderFloorScreen, requestRow, seatRow, tableRow, type FloorApi } from './floorTestApi.tsx';
import { LiveFloorScreen } from './LiveFloorScreen.tsx';

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

const TABLES = [
  tableRow('t1', 'Table 1', { type: 'tt1' }), tableRow('t2', 'Table 2'), tableRow('t4', 'Table 4', { is_open: false }), tableRow('t6', 'Private Room', { room: 'private' }),
];
const SEATS = [
  seatRow({ session: 's1', table: 't1', seat: 2, name: 'Vidya Chadha', top_up: 'requested' }), seatRow({ session: 's2', table: 't1', seat: 5, name: 'Kabir Sethi', time: { id: 'r1', minutes: 60 } }),
  seatRow({ session: 's3', table: 't2', seat: 1, name: 'Naina Kapoor', left: 0 }), seatRow({ session: 's4', table: 't2', seat: 3, name: 'Rohan Bhatia', leaving: true, left: 1800 }),
];
const REQUESTS = [
  requestRow({ kind: 'join', id: 'e1', name: 'Ritika Bhalla', minutes: 6, table_id: 't2' }),
  requestRow({ kind: 'top_up', id: 'u1', name: 'Vidya Chadha', minutes: 4, session_id: 's1', table_id: 't1', seat: 2, call_time_left: 7200 }),
  requestRow({ kind: 'time', id: 'r1', name: 'Kabir Sethi', minutes: 3, session_id: 's2', table_id: 't1', seat: 5, asked: 60, call_time_left: 7200 }),
  requestRow({ kind: 'leaving', id: 's4', name: 'Rohan Bhatia', minutes: 2, session_id: 's4', table_id: 't2', seat: 3, call_time_left: 1800 }),
];
const FLOOR: FloorApi = { tables: TABLES, seats: SEATS, requests: REQUESTS, lengths: [{ table_id: 't2', waiting: 2, call_time_minutes: 180 }] };

/** The floor, read: Table 1's tile is there. */
async function renderFloor(api: FloorApi = FLOOR) {
  const view = renderFloorScreen(LiveFloorScreen, api);
  // The first read waits as long as other screens' do: CI's machines are slow under load.
  await screen.findByRole('group', { name: 'Table 1 50/100' }, { timeout: 5000 });
  return view;
}

const requests = () => screen.getByRole('complementary', { name: 'Requests' });

/** The first of what was found. */
function first<T>(found: T[]): T {
  const [one] = found;
  if (one === undefined) throw new Error('Nothing found');
  return one;
}

describe('Live floor tiles (console v3)', () => {
  it('groups active tables by room, and a closed table says so with Open table, undone from its toast', async () => {
    const { rpcs } = await renderFloor();
    expect(screen.getByRole('region', { name: 'Main room' })).toBeDefined();
    expect(within(screen.getByRole('region', { name: 'Private Room' })).getByRole('group', { name: 'Private Room 100/200' })).toBeDefined();
    const closed = screen.getByRole('group', { name: 'Table 4 100/200' });
    expect(within(closed).getByText('Closed')).toBeDefined();
    fireEvent.click(within(closed).getByRole('button', { name: 'Open table' }));
    await screen.findByText('Table 4 opened');
    expect(rpcs('set_table_open')).toEqual([{ p_table_id: 't4', p_is_open: true }]);
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await screen.findByText('Undone');
    expect(rpcs('set_table_open')).toEqual([{ p_table_id: 't4', p_is_open: true }, { p_table_id: 't4', p_is_open: false }]);
  });

  it('shows seats in Seats view, gold asks on their rows, and Needs you keeps only the tables that need the floor', async () => {
    await renderFloor();
    expect(screen.queryByRole('button', { name: 'Seat 2, Vidya Chadha, Top-up' })).toBeNull();
    fireEvent.click(screen.getByRole('radio', { name: 'Seats' }));
    expect(screen.getByRole('button', { name: 'Seat 2, Vidya Chadha, Top-up' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Seat 5, Kabir Sethi, +1 h?' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Seat 1, Naina Kapoor, Done' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Needs you' }));
    expect(screen.queryByRole('group', { name: 'Private Room 100/200' })).toBeNull();
    expect(screen.queryByRole('group', { name: 'Table 4 100/200' })).toBeNull();
    expect(screen.getByRole('group', { name: 'Table 2 100/200' })).toBeDefined();
  });

  it('has one gold button, Seat a player, which opens the first open table someone waits for', async () => {
    await renderFloor();
    const seat = screen.getByRole('button', { name: 'Seat a player' });
    expect(seat.className).toContain('bg-action');
    fireEvent.click(seat);
    const sheet = await screen.findByRole('dialog', { name: 'Seat a player' });
    expect(within(sheet).getByText('Table 2, seat 2 · 100/200')).toBeDefined();
  });
});

describe('The requests panel (console v3)', () => {
  it('lists every request oldest first, each late past its target in words as well as colour', async () => {
    await renderFloor();
    const panel = requests();
    const names = within(panel).getAllByRole('button').map((button) => button.textContent);
    expect(names.filter((name) => ['Ritika Bhalla', 'Vidya Chadha', 'Kabir Sethi', 'Rohan Bhatia'].includes(name ?? ''))).toEqual(
      ['Ritika Bhalla', 'Vidya Chadha', 'Kabir Sethi', 'Rohan Bhatia']);
    expect(within(panel).getByText('Join request')).toBeDefined();
    expect(within(panel).getByText('Table 2 waitlist')).toBeDefined();
    expect(within(panel).getByText('Wants +1 h')).toBeDefined();
    // A join six minutes old and a top-up four minutes old are past their targets; more time three minutes old is not.
    expect(within(panel).getByText('Late · 6 min').className).toContain('text-danger');
    expect(within(panel).getByText('Late · 4 min').className).toContain('text-danger');
    expect(within(panel).getByText('3 min').className).not.toContain('text-danger');
  });

  it('approves a join with a toast whose Undo calls the database\'s undo', async () => {
    const { rpcs } = await renderFloor();
    fireEvent.click(first(within(requests()).getAllByRole('button', { name: 'Approve' })));
    await screen.findByText('Ritika Bhalla added to the Table 2 list');
    expect(rpcs('approve_waitlist_request')).toEqual([{ p_entry_id: 'e1' }]);
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await screen.findByText('Undone');
    expect(rpcs('undo_waitlist_decision')).toEqual([{ p_entry_id: 'e1' }]);
  });

  it('starts a top-up and declines more time, each undone by its own compensating call', async () => {
    const { rpcs } = await renderFloor();
    fireEvent.click(within(requests()).getByRole('button', { name: 'Start' }));
    await screen.findByText('Top-up started for Vidya Chadha');
    expect(rpcs('set_top_up')).toEqual([{ p_session_id: 's1', p_in_progress: true }]);
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(rpcs('undo_top_up')).toEqual([{ p_request_id: 'u1' }]));
    fireEvent.click(first(within(requests()).getAllByRole('button', { name: 'Decline' }).slice(1)));
    await screen.findByText('Kabir Sethi: time request declined');
    expect(rpcs('decide_call_time_request')).toEqual([{ p_request_id: 'r1', p_is_approved: false }]);
  });

  it('says when Undo comes too late', async () => {
    const { rpcs } = await renderFloor({ ...FLOOR, replies: { undo_waitlist_decision: { status: 400, body: { code: '22023', message: 'moved on' } } } });
    fireEvent.click(first(within(requests()).getAllByRole('button', { name: 'Decline' })));
    await screen.findByText('Ritika Bhalla: join declined');
    expect(rpcs('decline_waitlist_request')).toEqual([{ p_entry_id: 'e1' }]);
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(await screen.findByText('Not undone. It changed since.')).toBeDefined();
  });

  it('folds to a strip with its count, and opens again', async () => {
    // An ID check first and a wait for a seat have nothing for the floor to do yet: they are not counted.
    const quiet = [
      requestRow({ kind: 'seat_check', id: 'e8', name: 'Dev Khanna', minutes: 30, table_id: 't2' }),
      requestRow({ kind: 'seat_wait', id: 'e9', name: 'Mira Shah', minutes: 20, table_id: 't2' }),
    ];
    await renderFloor({ ...FLOOR, requests: [...quiet, ...REQUESTS] });
    fireEvent.click(within(requests()).getByRole('button', { name: 'Collapse' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Open, 4 waiting' }));
    expect(within(requests()).getByText('Ritika Bhalla')).toBeDefined();
  });
});

describe('The floor\'s keys (console v3)', () => {
  it('approves the oldest request with A, declines it with D, and seats a player with S; not while typing', async () => {
    const { rpcs } = await renderFloor();
    fireEvent.keyDown(window, { key: 'a' });
    await waitFor(() => expect(rpcs('approve_waitlist_request')).toEqual([{ p_entry_id: 'e1' }]));
    fireEvent.keyDown(window, { key: 'D' });
    await waitFor(() => expect(rpcs('decline_waitlist_request')).toEqual([{ p_entry_id: 'e1' }]));
    fireEvent.keyDown(window, { key: 's' });
    const sheet = await screen.findByRole('dialog', { name: 'Seat a player' });
    // In the sheet, typing an S is a number's, not the floor's.
    fireEvent.keyDown(within(sheet).getByRole('textbox', { name: 'Or a mobile or member number' }), { key: 'a' });
    expect(rpcs('approve_waitlist_request')).toHaveLength(1);
  });

  it('acts with A on the request whose button holds the focus, not the oldest (WCAG 2.1.4)', async () => {
    const { rpcs } = await renderFloor({ ...FLOOR, requests: [...REQUESTS, requestRow({ kind: 'join', id: 'e2', name: 'Meher Kapoor', minutes: 1, table_id: 't2' })] });
    const meher = within(requests()).getByText('Meher Kapoor').closest('[data-request]');
    if (!(meher instanceof HTMLElement)) throw new Error('no request row for Meher Kapoor');
    within(meher).getByRole('button', { name: 'Approve' }).focus();
    fireEvent.keyDown(meher, { key: 'a' });
    await waitFor(() => expect(rpcs('approve_waitlist_request')).toEqual([{ p_entry_id: 'e2' }]));
  });

  it('passes over approved players with A: seating one is the floor\'s own press, never a key', async () => {
    const older = [
      requestRow({ kind: 'seat', id: 'e7', name: 'Arjun Rao', minutes: 40, table_id: 't2', seat: 4 }),
      requestRow({ kind: 'seat_check', id: 'e8', name: 'Dev Khanna', minutes: 30, table_id: 't2' }),
      requestRow({ kind: 'seat_wait', id: 'e9', name: 'Mira Shah', minutes: 20, table_id: 't2' }),
    ];
    const { rpcs, router } = await renderFloor({ ...FLOOR, requests: [...older, ...REQUESTS] });
    fireEvent.keyDown(window, { key: 'a' });
    await waitFor(() => expect(rpcs('approve_waitlist_request')).toEqual([{ p_entry_id: 'e1' }]));
    expect(rpcs('seat_from_waitlist')).toEqual([]);
    expect(router.state.location.pathname).toBe('/');
  });
});
