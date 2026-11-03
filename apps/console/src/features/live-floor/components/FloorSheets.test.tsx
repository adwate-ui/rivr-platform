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

const FLOOR: FloorApi = {
  tables: [tableRow('t1', 'Table 1', { type: 'tt1' }), tableRow('t2', 'Table 2'), tableRow('t3', 'Table 3'), tableRow('t4', 'Table 4', { is_open: false })],
  seats: [
    seatRow({ session: 's2', table: 't1', seat: 5, name: 'Kabir Sethi', time: { id: 'r1', minutes: 60 } }), seatRow({ session: 's3', table: 't2', seat: 1, name: 'Naina Kapoor', left: 0 }),
    seatRow({ session: 's4', table: 't2', seat: 3, name: 'Rohan Bhatia', leaving: true, left: 1800 }),
  ],
  requests: [
    requestRow({ kind: 'time', id: 'r1', name: 'Kabir Sethi', minutes: 3, session_id: 's2', table_id: 't1', seat: 5, asked: 60, call_time_left: 7200 }),
    requestRow({ kind: 'leaving', id: 's4', name: 'Rohan Bhatia', minutes: 2, session_id: 's4', table_id: 't2', seat: 3, call_time_left: 1800 }),
    requestRow({ kind: 'left_owing', id: 'm9', name: 'Yash Gupta', minutes: 1, session_id: 's9', table_id: 't3', seat: 4, owed_seconds: 2700 }),
  ],
  board: [{ entry_id: 'e7', table_type_id: 'tt2', member_id: 'm7', full_name: 'Leela Menon', joined_at: '2026-11-15T16:18:00Z', place: 1, added_by_floor: false,
    priority_reason: null, call_table_name: null, call_seat: null, hold_until: null, away_until: null, asked_table_id: 't2', on_way_at: null }],
};

async function renderFloor(api: FloorApi = FLOOR) {
  const view = renderFloorScreen(LiveFloorScreen, api);
  await screen.findByRole('group', { name: 'Table 1 50/100' }, { timeout: 5000 });
  fireEvent.click(screen.getByRole('radio', { name: 'Seats' }));
  return view;
}

const sheet = (name: string) => screen.findByRole('dialog', { name });
const tile = (name: string) => screen.getByRole('group', { name });

/** The first of what was found: a sheet's own Leave before its foot's, say. */
function first<T>(found: T[]): T {
  const [one] = found;
  if (one === undefined) throw new Error('Nothing found');
  return one;
}

describe('The player sheet (console v3)', () => {
  it('shows the call time left with its bar, the ask with its actions, Add time, Move and the member record', async () => {
    const { rpcs } = await renderFloor();
    fireEvent.click(screen.getByRole('button', { name: 'Seat 5, Kabir Sethi, +1 h?' }));
    const player = await sheet('Kabir Sethi');
    expect(within(player).getByText('Table 1 · seat 5 · Black card')).toBeDefined();
    expect(within(player).getByText('2 h left')).toBeDefined();
    expect(within(player).getByText('Wants +1 h')).toBeDefined();
    expect(within(player).getByRole('button', { name: 'Open member record' })).toBeDefined();
    fireEvent.click(await within(player).findByRole('button', { name: '+30 min' }));
    await screen.findByText('Kabir Sethi: call time +30 min');
    const [added] = rpcs('add_seat_call_time');
    expect(added).toMatchObject({ p_session_id: 's2', p_minutes: 30 });
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    // Undo finds the addition by the request id it was made with (decision 0447).
    await waitFor(() => expect(rpcs('undo_call_time')).toEqual([{ p_request_id: Reflect.get(Object(added), 'p_idempotency_key') }]));
  });

  it('moves a player to a table chosen first, then a seat, and Undo moves them back', async () => {
    const { rpcs } = await renderFloor();
    fireEvent.click(screen.getByRole('button', { name: 'Seat 5, Kabir Sethi, +1 h?' }));
    const player = await sheet('Kabir Sethi');
    // Closed tables are offered no seat.
    expect(within(player).queryByRole('radio', { name: /^Table 4/ })).toBeNull();
    fireEvent.click(within(player).getByRole('radio', { name: 'Table 2 · 7 open' }));
    fireEvent.click(within(player).getByRole('radio', { name: '2' }));
    await screen.findByText('Kabir Sethi moved to Table 2, seat 2');
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(rpcs('move_seat')).toEqual([
      { p_session_id: 's2', p_table_id: 't2', p_seat: 2 }, { p_session_id: 's2', p_table_id: 't1', p_seat: 5 },
    ]));
  });

  it('gives a host no Add time, and no Open or Close on a table', async () => {
    await renderFloor({ ...FLOOR, role: 'host' });
    fireEvent.click(screen.getByRole('button', { name: 'Seat 5, Kabir Sethi, +1 h?' }));
    const player = await sheet('Kabir Sethi');
    expect(within(player).queryByText('Add time')).toBeNull();
    expect(within(player).getByText('Move to another seat')).toBeDefined();
    fireEvent.click(first(within(player).getAllByRole('button', { name: 'Close' })));
    fireEvent.click(screen.getByRole('button', { name: 'Settings for Table 2' }));
    const table = await sheet('Table 2');
    expect(within(table).queryByRole('button', { name: 'Close table for tonight' })).toBeNull();
  });
});

describe('Leaving (console v3)', () => {
  it('lets a player owing call time go only with a reason, written to their record; no Undo', async () => {
    const { rpcs } = await renderFloor();
    fireEvent.click(first(within(screen.getByRole('complementary', { name: 'Requests' })).getAllByRole('button', { name: 'Leave' })));
    const leave = await sheet('Let go before call time');
    expect(within(leave).getByText('Rohan Bhatia still owes 30 min of call time.')).toBeDefined();
    fireEvent.click(within(leave).getByRole('button', { name: 'Let go early' }));
    expect(within(leave).getByText('Pick a reason to let them go before call time.')).toBeDefined();
    expect(rpcs('let_leave_early')).toEqual([]);
    fireEvent.click(within(leave).getByRole('radio', { name: 'Table broke' }));
    fireEvent.click(within(leave).getByRole('button', { name: 'Let go early' }));
    await screen.findByText('Rohan Bhatia let go early');
    expect(rpcs('let_leave_early')).toEqual([{ p_venue_id: 'v1', p_member_id: 'm-s4', p_reason: 'Table broke' }]);
    expect(rpcs('end_seat')).toEqual([{ p_session_id: 's4', p_reason: 'left' }]);
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
  });

  it('records why one who left owing call time was let go', async () => {
    const { rpcs } = await renderFloor();
    fireEvent.click(within(screen.getByRole('complementary', { name: 'Requests' })).getByRole('button', { name: 'Record' }));
    const leave = await sheet('Let go before call time');
    fireEvent.click(within(leave).getByRole('radio', { name: 'Unwell' }));
    fireEvent.click(within(leave).getByRole('button', { name: 'Let go early' }));
    await screen.findByText('Yash Gupta let go early');
    expect(rpcs('let_leave_early')).toEqual([{ p_venue_id: 'v1', p_member_id: 'm-m9', p_reason: 'Unwell' }]);
    expect(rpcs('end_seat')).toEqual([]);
  });

  it('lets a player whose call time is met leave, with Undo', async () => {
    const { rpcs } = await renderFloor();
    fireEvent.click(screen.getByRole('button', { name: 'Seat 1, Naina Kapoor, Done' }));
    fireEvent.click(within(await sheet('Naina Kapoor')).getByRole('button', { name: 'Leave' }));
    fireEvent.click(within(await sheet('Naina Kapoor leaves')).getByRole('button', { name: 'Yes, they leave' }));
    await screen.findByText('Naina Kapoor left Table 2');
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(rpcs('undo_leave')).toEqual([{ p_session_id: 's3' }]));
  });

  it('frees the seat owing for floor staff without the override, with Undo', async () => {
    const { rpcs } = await renderFloor({ ...FLOOR, role: 'host' });
    fireEvent.click(screen.getByRole('button', { name: 'Seat 3, Rohan Bhatia, Leaving' }));
    fireEvent.click(first(within(await sheet('Rohan Bhatia')).getAllByRole('button', { name: 'Leave' })));
    const leave = await sheet('Let go before call time');
    expect(within(leave).queryByRole('radio', { name: 'Emergency' })).toBeNull();
    fireEvent.click(within(leave).getByRole('button', { name: 'Leave owing' }));
    await screen.findByText('Rohan Bhatia left Table 2');
    expect(rpcs('let_leave_early')).toEqual([]);
  });
});

describe('The seat sheet (console v3)', () => {
  it('seats the next on the table\'s list, or a number typed, with the call time chosen; Undo takes the seat back', async () => {
    const { rpcs } = await renderFloor({ ...FLOOR, replies: { seat_member: { status: 200, body: 's9' } } });
    fireEvent.click(within(tile('Table 1 50/100')).getByRole('button', { name: 'Seat 4, Open' }));
    const seat = await sheet('Seat a player');
    expect(within(seat).getByText('Next on the Table 1 list')).toBeDefined();
    expect(within(seat).getByText('Nobody on this list.')).toBeDefined();
    fireEvent.click(within(seat).getByRole('button', { name: 'Seat' }));
    expect(within(seat).getByText('Choose a player or type a number.')).toBeDefined();
    fireEvent.click(within(seat).getByRole('radio', { name: 'Table 2' }));
    expect(within(seat).getByRole('radio', { name: 'Leela Menon · 12 min' }).getAttribute('aria-checked')).toBe('true');
    fireEvent.change(within(seat).getByRole('textbox', { name: 'Or a mobile or member number' }), { target: { value: '42' } });
    fireEvent.click(within(seat).getByRole('radio', { name: '4 h' }));
    fireEvent.click(within(seat).getByRole('button', { name: 'Seat' }));
    await screen.findByText('42 seated at Table 2, seat 2');
    expect(rpcs('seat_member')).toEqual([{ p_table_id: 't2', p_seat: 2, p_member_number: 42, p_call_minutes: 240 }]);
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(rpcs('undo_seat')).toEqual([{ p_session_id: 's9' }]));
  });

  it('assigns the next on the list in one step (decision 0299)', async () => {
    const { rpcs } = await renderFloor();
    fireEvent.click(within(tile('Table 2 100/200')).getByRole('button', { name: 'Seat 2, Open' }));
    const seat = await sheet('Seat a player');
    // The next on Table 2's list is chosen as the list is read.
    await within(seat).findByRole('radio', { name: 'Leela Menon · 12 min' });
    fireEvent.click(within(seat).getByRole('button', { name: 'Seat' }));
    await screen.findByText('Leela Menon seated at Table 2, seat 2');
    expect(rpcs('assign_from_waitlist')).toEqual([{ p_entry_id: 'e7', p_table_id: 't2', p_seat: 2, p_call_minutes: 180 }]);
  });
});

describe('The table sheet (console v3)', () => {
  it('says the table\'s status, seated, dealer and waiting; Close waits for an empty table; Must move to is undone', async () => {
    const { rpcs } = await renderFloor();
    fireEvent.click(screen.getByRole('button', { name: 'Settings for Table 2' }));
    const table = await sheet('Table 2');
    for (const text of ['Open', '2 of 9', 'None assigned']) expect(within(table).getByText(text)).toBeDefined();
    expect(within(table).getByRole('button', { name: 'Close table for tonight' }).hasAttribute('disabled')).toBe(true);
    expect(within(table).getByText('Seat everyone elsewhere first.')).toBeDefined();
    // Only tables at the same stake: Table 1 plays 50/100.
    expect(within(table).queryByRole('radio', { name: 'Table 1' })).toBeNull();
    fireEvent.click(within(table).getByRole('radio', { name: 'Table 3' }));
    await screen.findByText('Table 2 moves to Table 3');
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(rpcs('set_must_move')).toEqual([{ p_table_id: 't2', p_main_table_id: 't3' }, { p_table_id: 't2' }]));
  });
});
