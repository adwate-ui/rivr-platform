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

/** Naina's call time is met; Rohan asked to leave owing 30 min; Yash already left his seat owing 45 min. */
const FLOOR: FloorApi = {
  tables: [tableRow('t1', 'Table 1', { type: 'tt1' }), tableRow('t2', 'Table 2'), tableRow('t3', 'Table 3')],
  seats: [
    seatRow({ session: 's3', table: 't2', seat: 1, name: 'Naina Kapoor', left: 0 }),
    seatRow({ session: 's4', table: 't2', seat: 3, name: 'Rohan Bhatia', leaving: true, left: 1800 }),
  ],
  requests: [
    requestRow({ kind: 'leaving', id: 's4', name: 'Rohan Bhatia', minutes: 2, session_id: 's4', table_id: 't2', seat: 3, call_time_left: 1800 }),
    requestRow({ kind: 'left_owing', id: 'm9', name: 'Yash Gupta', minutes: 1, session_id: 's9', table_id: 't3', seat: 4, owed_seconds: 2700 }),
  ],
};

/** A check-out the database accepts. */
const CHECKED_OUT = { check_out: { status: 200, body: 'visit-1' } };

async function renderFloor(api: FloorApi = FLOOR) {
  const view = renderFloorScreen(LiveFloorScreen, api);
  await screen.findByRole('group', { name: 'Table 1 NLH 50/100' }, { timeout: 5000 });
  fireEvent.click(screen.getByRole('radio', { name: 'Seats' }));
  return view;
}

const sheet = (name: string) => screen.findByRole('dialog', { name });

/** The first of what was found: a sheet's own Leave before its foot's, say. */
function first<T>(found: T[]): T {
  const [one] = found;
  if (one === undefined) throw new Error('Nothing found');
  return one;
}

/** Opens Leave from Rohan's request: he owes call time. */
async function leaveOwing() {
  fireEvent.click(first(within(screen.getByRole('complementary', { name: 'Requests' })).getAllByRole('button', { name: 'Leave' })));
  return sheet('Let go before call time');
}

/** Opens Leave from Naina's seat: her call time is met. */
async function leaveMet() {
  fireEvent.click(screen.getByRole('button', { name: 'Seat 1, Naina Kapoor, Call time done' }));
  fireEvent.click(within(await sheet('Naina Kapoor')).getByRole('button', { name: 'Leave' }));
  return sheet('Naina Kapoor leaves');
}

describe('Leaving (console v3)', () => {
  it('lets a player owing call time go only with a reason, written to their record; no Undo', async () => {
    const { rpcs } = await renderFloor();
    const leave = await leaveOwing();
    expect(within(leave).getByText('Rohan Bhatia: 30 min call time owed.')).toBeDefined();
    fireEvent.click(within(leave).getByRole('button', { name: 'Let go early' }));
    expect(within(leave).getByText('Pick why they leave.')).toBeDefined();
    expect(rpcs('let_leave_early')).toEqual([]);
    fireEvent.click(within(leave).getByRole('radio', { name: 'Table broke' }));
    fireEvent.click(within(leave).getByRole('button', { name: 'Let go early' }));
    await screen.findByText('Rohan Bhatia let go early');
    expect(rpcs('let_leave_early')).toEqual([{ p_venue_id: 'v1', p_member_id: 'm-s4', p_reason: 'Table broke' }]);
    expect(rpcs('end_seat')).toEqual([{ p_session_id: 's4', p_reason: 'left', p_leave_reason: 'table_broke' }]);
    expect(rpcs('check_out')).toEqual([]);
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

  it('lets a player whose call time is met leave, Call time met picked already as why, with Undo', async () => {
    const { rpcs } = await renderFloor();
    const leave = await leaveMet();
    expect(within(leave).getByRole('radio', { name: 'Call time met' }).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(within(leave).getByRole('button', { name: 'Yes, they leave' }));
    await screen.findByText('Naina Kapoor left Table 2');
    expect(rpcs('end_seat')).toEqual([{ p_session_id: 's3', p_reason: 'left', p_leave_reason: 'call_time_met' }]);
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(rpcs('undo_leave')).toEqual([{ p_session_id: 's3' }]));
  });

  it('frees the seat owing for floor staff without the override, asking why, with Undo, and offers no check-out', async () => {
    const { rpcs } = await renderFloor({ ...FLOOR, role: 'host' });
    fireEvent.click(screen.getByRole('button', { name: 'Seat 3, Rohan Bhatia, Leaving' }));
    fireEvent.click(first(within(await sheet('Rohan Bhatia')).getAllByRole('button', { name: 'Leave' })));
    const leave = await sheet('Let go before call time');
    // Freeing a seat owing keeps the member in the club: the check-out would be refused, so it is not offered.
    expect(within(leave).queryByRole('button', { name: /check out/ })).toBeNull();
    // Every leave says why (#1060): owing, none is picked for them.
    fireEvent.click(within(leave).getByRole('button', { name: 'Leave owing' }));
    expect(within(leave).getByText('Pick why they leave.')).toBeDefined();
    fireEvent.click(within(leave).getByRole('radio', { name: 'Emergency' }));
    fireEvent.click(within(leave).getByRole('button', { name: 'Leave owing' }));
    await screen.findByText('Rohan Bhatia left Table 2');
    expect(rpcs('let_leave_early')).toEqual([]);
    expect(rpcs('end_seat')).toEqual([{ p_session_id: 's4', p_reason: 'left', p_leave_reason: 'emergency' }]);
  });

  it('lets a player go early as busted and checks them out of the club in the same step (owner, 16 Nov)', async () => {
    const { rpcs } = await renderFloor({ ...FLOOR, replies: CHECKED_OUT });
    const leave = await leaveOwing();
    fireEvent.click(within(leave).getByRole('radio', { name: 'Busted' }));
    fireEvent.click(within(leave).getByRole('button', { name: 'Let go early and check out' }));
    await screen.findByText('Rohan Bhatia let go early and checked out');
    expect(rpcs('let_leave_early')).toEqual([{ p_venue_id: 'v1', p_member_id: 'm-s4', p_reason: 'Busted' }]);
    expect(rpcs('end_seat')).toEqual([{ p_session_id: 's4', p_reason: 'left', p_leave_reason: 'busted' }]);
    expect(rpcs('check_out')).toEqual([{ p_venue_id: 'v1', p_member_id: 'm-s4' }]);
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
  });

  it('lets a player whose call time is met leave and checks them out, with no Undo', async () => {
    const { rpcs } = await renderFloor({ ...FLOOR, replies: CHECKED_OUT });
    const leave = await leaveMet();
    // Both are offered: staff choose (owner, 16 Nov).
    expect(within(leave).getByRole('button', { name: 'Yes, they leave' })).toBeDefined();
    fireEvent.click(within(leave).getByRole('button', { name: 'Leave and check out' }));
    await screen.findByText('Naina Kapoor left Table 2 and checked out');
    expect(rpcs('end_seat')).toEqual([{ p_session_id: 's3', p_reason: 'left', p_leave_reason: 'call_time_met' }]);
    expect(rpcs('check_out')).toEqual([{ p_venue_id: 'v1', p_member_id: 'm-s3' }]);
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
  });

  it('records why one who left owing was let go, and checks them out with it', async () => {
    const { rpcs } = await renderFloor({ ...FLOOR, replies: CHECKED_OUT });
    fireEvent.click(within(screen.getByRole('complementary', { name: 'Requests' })).getByRole('button', { name: 'Record' }));
    const leave = await sheet('Let go before call time');
    fireEvent.click(within(leave).getByRole('radio', { name: 'Busted' }));
    fireEvent.click(within(leave).getByRole('button', { name: 'Let go early and check out' }));
    await screen.findByText('Yash Gupta let go early and checked out');
    expect(rpcs('end_seat')).toEqual([]);
    expect(rpcs('check_out')).toEqual([{ p_venue_id: 'v1', p_member_id: 'm-m9' }]);
  });

  it('counts one already out of the club as checked out', async () => {
    const out = { status: 400, body: { code: 'RVOUT', message: 'Not checked in', details: '' } };
    await renderFloor({ ...FLOOR, replies: { check_out: out } });
    fireEvent.click(within(await leaveMet()).getByRole('button', { name: 'Leave and check out' }));
    await screen.findByText('Naina Kapoor left Table 2 and checked out');
  });

  it('keeps the seat freed, with Undo, and says to check out at the door when the check-out is refused', async () => {
    const frozen = { status: 400, body: { code: 'RVFRZ', message: 'The venue is frozen', details: '' } };
    const { rpcs } = await renderFloor({ ...FLOOR, replies: { check_out: frozen } });
    const leave = await leaveMet();
    fireEvent.click(within(leave).getByRole('button', { name: 'Leave and check out' }));
    await screen.findByText('Naina Kapoor not checked out. Check them out at the door.');
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(rpcs('undo_leave')).toEqual([{ p_session_id: 's3' }]));
  });

});
