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
  seatRow({ session: 's1', table: 't1', seat: 2, name: 'Vidya Chadha', top_up: 'requested' }),
  // Kabir set his call time, which ends at 23:40 IST (#1076); Tara's countdown is done with none set, so she still owes it.
  seatRow({ session: 's2', table: 't1', seat: 5, name: 'Kabir Sethi', set_at: '2026-11-15T15:00:00Z', ends_at: '2026-11-15T18:10:00Z', left: 6000 }),
  seatRow({ session: 's5', table: 't1', seat: 7, name: 'Tara Menon', left: 0, owes: true }),
  seatRow({ session: 's3', table: 't2', seat: 1, name: 'Naina Kapoor', left: 0 }), seatRow({ session: 's4', table: 't2', seat: 3, name: 'Rohan Bhatia', leaving: true, left: 1800 }),
];
const REQUESTS = [
  requestRow({ kind: 'join', id: 'e1', name: 'Ritika Bhalla', minutes: 6, table_id: 't2' }),
  requestRow({ kind: 'top_up', id: 'u1', name: 'Vidya Chadha', minutes: 4, session_id: 's1', table_id: 't1', seat: 2, call_time_left: 7200 }),
  requestRow({ kind: 'leaving', id: 's4', name: 'Rohan Bhatia', minutes: 2, session_id: 's4', table_id: 't2', seat: 3, call_time_left: 1800 }),
];
const FLOOR: FloorApi = { tables: TABLES, seats: SEATS, requests: REQUESTS, lengths: [{ table_id: 't2', waiting: 2, call_time_minutes: 180 }] };

/** The floor, read: Table 1's tile is there. */
async function renderFloor(api: FloorApi = FLOOR) {
  const view = renderFloorScreen(LiveFloorScreen, api);
  // The first read waits as long as other screens' do: CI's machines are slow under load.
  await screen.findByRole('group', { name: 'Table 1 NLH 50/100' }, { timeout: 5000 });
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
    expect(within(screen.getByRole('region', { name: 'Private Room' })).getByRole('group', { name: 'Private Room NLH 100/200' })).toBeDefined();
    const closed = screen.getByRole('group', { name: 'Table 4 NLH 100/200' });
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
    expect(screen.getByRole('button', { name: 'Seat 5, Kabir Sethi, Leaves 23:40' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Seat 7, Tara Menon, Call time not set' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Seat 1, Naina Kapoor, Call time done' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Needs you' }));
    expect(screen.queryByRole('group', { name: 'Private Room NLH 100/200' })).toBeNull();
    expect(screen.queryByRole('group', { name: 'Table 4 NLH 100/200' })).toBeNull();
    expect(screen.getByRole('group', { name: 'Table 2 NLH 100/200' })).toBeDefined();
  });

  it('has one gold button, Seat a player, which opens the first open table someone waits for', async () => {
    await renderFloor();
    const seat = screen.getByRole('button', { name: 'Seat a player' });
    expect(seat.className).toContain('bg-action');
    fireEvent.click(seat);
    const sheet = await screen.findByRole('dialog', { name: 'Seat a player' });
    expect(within(sheet).getByText('Table 2, seat 2 · NLH 100/200')).toBeDefined();
  });
});

describe('The requests panel (console v3)', () => {
  it('opens when the address asks, and folding it takes the address back, so the header can open it again (audit F-078)', async () => {
    const { router } = renderFloorScreen(LiveFloorScreen, FLOOR, '/?panel=open');
    fireEvent.click(await screen.findByRole('button', { name: 'Collapse' }, { timeout: 5000 }));
    await waitFor(() => expect(router.state.location.search).toEqual({}));
    expect(screen.queryByRole('button', { name: 'Collapse' })).toBeNull();
    await router.navigate({ href: '/?panel=open' });
    expect(await screen.findByRole('button', { name: 'Collapse' })).toBeDefined();
  });

  it('lists requests oldest first, each late past its target in words as well as colour (audit F-108)', async () => {
    await renderFloor();
    const panel = requests();
    // Each request's own button is named as who asks; it covers the item, under the name's link.
    const names = within(panel).getAllByRole('button').map((button) => button.getAttribute('aria-label') ?? button.textContent);
    expect(names.filter((name) => ['Ritika Bhalla', 'Vidya Chadha', 'Rohan Bhatia'].includes(name ?? ''))).toEqual(['Ritika Bhalla', 'Vidya Chadha', 'Rohan Bhatia']);
    expect(within(panel).getByText('Join request')).toBeDefined();
    expect(within(panel).getByText('Table 2 waitlist')).toBeDefined();
    // A join six minutes old and a top-up four minutes old are past their targets.
    expect(within(panel).getByText('Late · 6 min').className).toContain('text-danger');
    expect(within(panel).getByText('Late · 4 min').className).toContain('text-danger');
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

  it('shows a member\'s own Set call time in Requests until the floor marks it seen (the owner, 19 Nov)', async () => {
    const set = requestRow({ kind: 'call_time_set', id: 'c1', name: 'Kabir Sethi', minutes: 1, session_id: 's2', table_id: 't1', seat: 5, asked: 60, call_time_left: 3600 });
    const { rpcs } = await renderFloor({ ...FLOOR, requests: [...REQUESTS, set] });
    expect(within(requests()).getByText('Call time set')).toBeDefined();
    expect(within(requests()).getByText(/^Table 1, seat 5 · leaves \d\d:\d\d$/)).toBeDefined();
    fireEvent.click(within(requests()).getByRole('button', { name: 'Seen' }));
    await screen.findByText('Kabir Sethi: call time seen');
    expect(rpcs('mark_call_time_seen')).toEqual([{ p_request_id: 'c1' }]);
  });

  it('starts a top-up, undone by its own compensating call', async () => {
    const { rpcs } = await renderFloor();
    fireEvent.click(within(requests()).getByRole('button', { name: 'Start' }));
    await screen.findByText('Top-up started for Vidya Chadha');
    expect(rpcs('set_top_up')).toEqual([{ p_session_id: 's1', p_in_progress: true }]);
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(rpcs('undo_top_up')).toEqual([{ p_request_id: 'u1' }]));
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
    // A wait for a seat folds into one line and is not counted; an ID check is a row the floor can act on, and is.
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

describe('The floor for a cashier', () => {
  it('offers the list in place of Check ID, and a name that opens nothing as plain text (audit F-014, F-025)', async () => {
    const check = requestRow({ kind: 'seat_check', id: 'e8', name: 'Dev Khanna', minutes: 30, table_id: 't2' });
    const { router } = await renderFloor({ ...FLOOR, role: 'cashier', requests: [check] });
    const panel = within(requests());
    const list = await panel.findByRole('button', { name: /View list/ });
    expect(panel.getByText('Dev Khanna')).toBeDefined();
    expect(panel.queryByRole('button', { name: 'Dev Khanna' })).toBeNull();
    expect(panel.queryByRole('button', { name: /Check ID/ })).toBeNull();
    fireEvent.click(list);
    await waitFor(() => expect(router.state.location.pathname).toBe('/waitlist'));
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
    fireEvent.keyDown(within(sheet).getByRole('textbox', { name: 'Name, mobile or member number' }), { key: 'a' });
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

  it('does nothing with A while the focus is on an approved player, never the oldest request instead', async () => {
    const seat = requestRow({ kind: 'seat', id: 'e7', name: 'Arjun Rao', minutes: 40, table_id: 't2', seat: 4 });
    const { rpcs } = await renderFloor({ ...FLOOR, requests: [seat, ...REQUESTS] });
    const arjun = within(requests()).getByText('Arjun Rao').closest('[data-request]');
    if (!(arjun instanceof HTMLElement)) throw new Error('no request row for Arjun Rao');
    first(within(arjun).getAllByRole('button')).focus();
    fireEvent.keyDown(arjun, { key: 'a' });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(rpcs('approve_waitlist_request')).toEqual([]);
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
