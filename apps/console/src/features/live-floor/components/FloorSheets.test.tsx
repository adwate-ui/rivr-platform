import { Text } from '@rivr/ui';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BonusByHandProvider } from './bonusByHand.ts';
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
    seatRow({ session: 's2', table: 't1', seat: 5, name: 'Kabir Sethi' }), seatRow({ session: 's3', table: 't2', seat: 1, name: 'Naina Kapoor', left: 0 }),
    seatRow({ session: 's4', table: 't2', seat: 3, name: 'Rohan Bhatia', leaving: true, left: 1800 }),
  ],
  requests: [
    requestRow({ kind: 'leaving', id: 's4', name: 'Rohan Bhatia', minutes: 2, session_id: 's4', table_id: 't2', seat: 3, call_time_left: 1800 }),
    requestRow({ kind: 'left_owing', id: 'm9', name: 'Yash Gupta', minutes: 1, session_id: 's9', table_id: 't3', seat: 4, owed_seconds: 2700 }),
  ],
  board: [{ entry_id: 'e7', table_type_id: 'tt2', member_id: 'm7', full_name: 'Leela Menon', joined_at: '2026-11-15T16:18:00Z', place: 1, added_by_floor: false,
    priority_reason: null, call_table_name: null, call_seat: null, hold_until: null, away_until: null, asked_table_id: 't2', on_way_at: null }],
};

async function renderFloor(api: FloorApi = FLOOR) {
  const view = renderFloorScreen(LiveFloorScreen, api);
  await screen.findByRole('group', { name: 'Table 1 NLH 50/100' }, { timeout: 5000 });
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

/** The floor with a form for Bonus by hand handed in, as the route hands in the member record's. */
const drawBonusStub = ({ memberId }: { venueId: string; memberId: string }) => <Text>{`Bonus by hand for ${memberId}`}</Text>;
const FloorWithBonus = () => <BonusByHandProvider value={drawBonusStub}><LiveFloorScreen /></BonusByHandProvider>;

describe('The player sheet (console v3)', () => {
  it('offers Bonus by hand to staff who may add it, as floor managers cannot open Members (redesign of 15 Nov)', async () => {
    renderFloorScreen(FloorWithBonus, { ...FLOOR, role: 'floor' });
    await screen.findByRole('group', { name: 'Table 1 NLH 50/100' }, { timeout: 5000 });
    fireEvent.click(screen.getByRole('radio', { name: 'Seats' }));
    fireEvent.click(screen.getByRole('button', { name: /^Seat 5, Kabir Sethi/ }));
    expect(within(await sheet('Kabir Sethi')).getByText('Bonus by hand for m-s2')).toBeDefined();
    cleanup();
    renderFloorScreen(FloorWithBonus, { ...FLOOR, role: 'cashier' });
    await screen.findByRole('group', { name: 'Table 1 NLH 50/100' }, { timeout: 5000 });
    fireEvent.click(screen.getByRole('radio', { name: 'Seats' }));
    fireEvent.click(screen.getByRole('button', { name: /^Seat 5, Kabir Sethi/ }));
    expect(within(await sheet('Kabir Sethi')).queryByText(/^Bonus by hand for /)).toBeNull();
  });

  it('offers the member record only to staff who may open Members, so a cashier is not sent to a refusal (audit F-025)', async () => {
    await renderFloor({ ...FLOOR, role: 'cashier' });
    fireEvent.click(screen.getByRole('button', { name: /^Seat 5, Kabir Sethi/ }));
    const player = await sheet('Kabir Sethi');
    expect(within(player).queryByRole('button', { name: 'Open member record' })).toBeNull();
  });

  it('shows the call time left with its bar, Set call time, Move and the member record', async () => {
    const { rpcs } = await renderFloor();
    fireEvent.click(screen.getByRole('button', { name: /^Seat 5, Kabir Sethi/ }));
    const player = await sheet('Kabir Sethi');
    expect(within(player).getByText('Table 1, seat 5 · Black card')).toBeDefined();
    expect(within(player).getByText('2 h left')).toBeDefined();
    expect(await within(player).findByText('Set call time')).toBeDefined();
    expect(within(player).getByRole('button', { name: 'Open member record' })).toBeDefined();
    // None set yet: lengths from now, not added (the owner, 19 Nov).
    fireEvent.click(await within(player).findByRole('button', { name: '30 min' }));
    await screen.findByText('Kabir Sethi: call time set, 30 min from now');
    const [added] = rpcs('add_seat_call_time');
    expect(added).toMatchObject({ p_session_id: 's2', p_minutes: 30 });
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    // Undo finds the addition by the request id it was made with (decision 0480).
    await waitFor(() => expect(rpcs('undo_call_time')).toEqual([{ p_request_id: Reflect.get(Object(added), 'p_idempotency_key') }]));
  });

  it('greys the lengths Set call time may not give yet, by the member\'s own rule; set, Extend and when they leave (the owner, 18 and 19 Nov)', async () => {
    const kabir = seatRow({ session: 's2', table: 't1', seat: 5, name: 'Kabir Sethi', open: [120] });
    await renderFloor({ ...FLOOR, seats: [kabir, ...(FLOOR.seats ?? []).slice(1)] });
    fireEvent.click(screen.getByRole('button', { name: /^Seat 5, Kabir Sethi/ }));
    const player = await sheet('Kabir Sethi');
    expect(await within(player).findByRole('button', { name: '30 min' })).toHaveProperty('disabled', true);
    expect(within(player).getByRole('button', { name: '2 h' })).toHaveProperty('disabled', false);
    // Why, tied to the lengths it closes alone.
    const why = within(player).getByText(/^Can't end before \d\d:\d\d\.$/);
    expect(within(player).getByRole('button', { name: '30 min' }).getAttribute('aria-describedby')).toBe(why.id);
    expect(within(player).getByRole('button', { name: '2 h' }).hasAttribute('aria-describedby')).toBe(false);
    cleanup();
    const set = seatRow({ session: 's2', table: 't1', seat: 5, name: 'Kabir Sethi', set_at: '2026-11-15T15:00:00Z', ends_at: '2026-11-15T18:10:00Z', left: 6000,
      open: [30, 60] });
    await renderFloor({ ...FLOOR, seats: [set, ...(FLOOR.seats ?? []).slice(1)] });
    fireEvent.click(screen.getByRole('button', { name: /^Seat 5, Kabir Sethi/ }));
    const setSheet = await sheet('Kabir Sethi');
    expect(within(setSheet).getByText('Set · leaves 23:40')).toBeDefined();
    // Set, the seat offers Extend's lengths, added beyond the end, and says so; no 'can't end before'.
    expect(within(setSheet).getByText('Extend call time')).toBeDefined();
    expect(within(setSheet).getByRole('button', { name: '+30 min' })).toHaveProperty('disabled', false);
    expect(within(setSheet).getByText('Extend adds time beyond the current end.')).toBeDefined();
    expect(within(setSheet).queryByText(/^Can't end before/)).toBeNull();
    // Two hours would take it past 24 hours: greyed, the sheet says why, and each length names the note (#1099).
    const pastMost = within(setSheet).getByText("Call time can't pass 24 hours.");
    const note = within(setSheet).getByText('Extend adds time beyond the current end.');
    expect(within(setSheet).getByRole('button', { name: '+2 h' })).toHaveProperty('disabled', true);
    expect(within(setSheet).getByRole('button', { name: '+2 h' }).getAttribute('aria-describedby')).toBe(`${note.id} ${pastMost.id}`);
    expect(within(setSheet).getByRole('button', { name: '+30 min' }).getAttribute('aria-describedby')).toBe(note.id);
    // Run out, it is just done: no "leaves".
    cleanup();
    const done = seatRow({ session: 's2', table: 't1', seat: 5, name: 'Kabir Sethi', set_at: '2026-11-15T15:00:00Z', ends_at: '2026-11-15T16:10:00Z', left: 0, owes: false });
    await renderFloor({ ...FLOOR, seats: [done, ...(FLOOR.seats ?? []).slice(1)] });
    fireEvent.click(screen.getByRole('button', { name: /^Seat 5, Kabir Sethi/ }));
    expect(within(await sheet('Kabir Sethi')).queryByText(/^Set · leaves/)).toBeNull();
  });

  it('offers one Leave: the card\'s once the player has asked to go (audit F-131)', async () => {
    await renderFloor();
    fireEvent.click(screen.getByRole('button', { name: /^Seat 3, Rohan Bhatia/ }));
    const player = await sheet('Rohan Bhatia');
    expect(within(player).getAllByRole('button', { name: 'Leave' })).toHaveLength(1);
    expect(within(player).getByRole('button', { name: 'Not leaving' })).toBeDefined();
  });

  it('moves a player to a table chosen first, then a seat, and Undo moves them back', async () => {
    const { rpcs } = await renderFloor();
    fireEvent.click(screen.getByRole('button', { name: /^Seat 5, Kabir Sethi/ }));
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

  it('gives a host no Set or Extend call time, and no Open or Close on a table', async () => {
    await renderFloor({ ...FLOOR, role: 'host' });
    fireEvent.click(screen.getByRole('button', { name: /^Seat 5, Kabir Sethi/ }));
    const player = await sheet('Kabir Sethi');
    expect(within(player).queryByText('Set call time')).toBeNull();
    expect(within(player).getByText('Move to another seat')).toBeDefined();
    fireEvent.click(first(within(player).getAllByRole('button', { name: 'Close' })));
    fireEvent.click(screen.getByRole('button', { name: 'Settings for Table 2' }));
    const table = await sheet('Table 2');
    expect(within(table).queryByRole('button', { name: 'Close table for tonight' })).toBeNull();
  });
});

describe('The seat sheet (console v3)', () => {
  it('seats the next on the table\'s list, or a number typed, with the call time chosen; Undo takes the seat back', async () => {
    const { rpcs } = await renderFloor({ ...FLOOR, replies: { seat_member: { status: 200, body: 's9' } } });
    fireEvent.click(within(tile('Table 1 NLH 50/100')).getByRole('button', { name: 'Seat 4, Open' }));
    const seat = await sheet('Seat a player');
    expect(within(seat).getByText('Next on the Table 1 list')).toBeDefined();
    expect(within(seat).getByText('Nobody on this list.')).toBeDefined();
    fireEvent.click(within(seat).getByRole('button', { name: 'Seat' }));
    expect(within(seat).getByText('Choose a player or type a number.')).toBeDefined();
    fireEvent.click(within(seat).getByRole('radio', { name: 'Table 2' }));
    expect(within(seat).getByRole('radio', { name: 'Leela Menon · 12 min' }).getAttribute('aria-checked')).toBe('true');
    fireEvent.change(within(seat).getByRole('textbox', { name: 'Or a name, mobile or member number' }), { target: { value: '42' } });
    // The call time starts from the stake's own and is typed over (redesign RD-19).
    expect(within(seat).getByRole('textbox', { name: 'Call time' })).toHaveProperty('value', '180');
    expect(within(seat).getByText('0 for no call time.')).toBeDefined();
    fireEvent.change(within(seat).getByRole('textbox', { name: 'Call time' }), { target: { value: '250' } });
    fireEvent.click(within(seat).getByRole('button', { name: 'Seat' }));
    await screen.findByText('42 seated at Table 2, seat 2');
    expect(rpcs('seat_member')).toEqual([{ p_table_id: 't2', p_seat: 2, p_member_number: 42, p_call_minutes: 250 }]);
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(rpcs('undo_seat')).toEqual([{ p_session_id: 's9' }]));
  });

  it('assigns the next on the list in one step (decision 0299)', async () => {
    const { rpcs } = await renderFloor();
    fireEvent.click(within(tile('Table 2 NLH 100/200')).getByRole('button', { name: 'Seat 2, Open' }));
    const seat = await sheet('Seat a player');
    // The next on Table 2's list is chosen as the list is read.
    await within(seat).findByRole('radio', { name: 'Leela Menon · 12 min' });
    fireEvent.click(within(seat).getByRole('button', { name: 'Seat' }));
    await screen.findByText('Leela Menon seated at Table 2, seat 2');
    expect(rpcs('assign_from_waitlist')).toEqual([{ p_entry_id: 'e7', p_table_id: 't2', p_seat: 2, p_call_minutes: 180 }]);
  });

  it('asks for a call time when the field is blank or past a day, and seats nobody (audit F-112)', async () => {
    const { rpcs } = await renderFloor();
    fireEvent.click(within(tile('Table 1 NLH 50/100')).getByRole('button', { name: 'Seat 4, Open' }));
    const seat = await sheet('Seat a player');
    fireEvent.change(within(seat).getByRole('textbox', { name: 'Name, mobile or member number' }), { target: { value: '42' } });
    fireEvent.change(within(seat).getByRole('textbox', { name: 'Call time' }), { target: { value: '' } });
    fireEvent.click(within(seat).getByRole('button', { name: 'Seat' }));
    expect(await within(seat).findByText('Type the call time in minutes, 0 to 1,440.')).toBeDefined();
    fireEvent.change(within(seat).getByRole('textbox', { name: 'Call time' }), { target: { value: '1441' } });
    expect(within(seat).getByText('Between 0 and 1,440 minutes.')).toBeDefined();
    fireEvent.click(within(seat).getByRole('button', { name: 'Seat' }));
    expect(rpcs('seat_member')).toEqual([]);
  });

  it('starts again from the new table\'s own call time when the table changes', async () => {
    const { rpcs } = await renderFloor();
    fireEvent.click(within(tile('Table 1 NLH 50/100')).getByRole('button', { name: 'Seat 4, Open' }));
    const seat = await sheet('Seat a player');
    fireEvent.change(within(seat).getByRole('textbox', { name: 'Name, mobile or member number' }), { target: { value: '42' } });
    fireEvent.change(within(seat).getByRole('textbox', { name: 'Call time' }), { target: { value: '' } });
    fireEvent.click(within(seat).getByRole('radio', { name: 'Table 2' }));
    expect(within(seat).getByRole('textbox', { name: 'Call time' })).toHaveProperty('value', '180');
    fireEvent.change(within(seat).getByRole('textbox', { name: /obile or member number$/ }), { target: { value: '42' } });
    fireEvent.click(within(seat).getByRole('button', { name: 'Seat' }));
    await waitFor(() => expect(rpcs('seat_member')).toEqual([expect.objectContaining({ p_table_id: 't2', p_call_minutes: 180 })]));
  });

});

describe('The Show link of a member record (console v3)', () => {
  it('opens the sheet of the seated player from the address', async () => {
    const view = renderFloorScreen(LiveFloorScreen, FLOOR, '/?table=t1&seat=5');
    expect(await screen.findByRole('dialog', { name: 'Kabir Sethi' }, { timeout: 5000 })).toBeDefined();
    expect(view.router.state.location.pathname).toBe('/');
  });

  it('shows the seats of the table pointed at when nobody sits in that seat', async () => {
    Element.prototype.scrollIntoView = vi.fn();
    renderFloorScreen(LiveFloorScreen, FLOOR, '/?table=t3&seat=2');
    expect(await within(await screen.findByRole('group', { name: 'Table 3 NLH 100/200' }, { timeout: 5000 })).findByRole('button', { name: 'Seat 2, Open' })).toBeDefined();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
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
