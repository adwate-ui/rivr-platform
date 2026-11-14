import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NOW, renderFloorScreen, tableRow, type FloorApi } from './floorTestApi.tsx';
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

const LEELA = { entry_id: 'e7', table_type_id: 'tt2', member_id: 'm7', full_name: 'Leela Menon', joined_at: '2026-11-15T16:18:00Z', place: 1, added_by_floor: false,
  priority_reason: null, call_table_name: null, call_seat: null, hold_until: null, away_until: null, asked_table_id: 't2', on_way_at: null };
const FLOOR: FloorApi = { tables: [tableRow('t1', 'Table 1', { type: 'tt1' }), tableRow('t2', 'Table 2')], board: [LEELA] };
// Leela's identity check is not done (decision 0503).
const UNCHECKED: FloorApi = { ...FLOOR, board: [{ ...LEELA, needs_id_check: true }] };

/** The seat sheet opened on Table 2's free seat, with the next on its list chosen. */
async function openForLeela(api: FloorApi = FLOOR) {
  const view = renderFloorScreen(LiveFloorScreen, api);
  await screen.findByRole('group', { name: 'Table 1 NLH 50/100' }, { timeout: 5000 });
  fireEvent.click(screen.getByRole('radio', { name: 'Seats' }));
  fireEvent.click(within(screen.getByRole('group', { name: 'Table 2 NLH 100/200' })).getByRole('button', { name: 'Seat 2, Open' }));
  const seat = await screen.findByRole('dialog', { name: 'Seat a player' });
  await within(seat).findByRole('radio', { name: 'Leela Menon · 12 min' });
  return { ...view, seat };
}

describe('The seat sheet and a member not checked yet', () => {
  it('sends one seating however often Seat is pressed while it is being answered', async () => {
    const { rpcs, seat } = await openForLeela();
    const press = within(seat).getByRole('button', { name: 'Seat' });
    for (let pressed = 0; pressed < 3; pressed += 1) fireEvent.click(press);
    await screen.findByText('Leela Menon seated at Table 2, seat 2');
    expect(rpcs('assign_from_waitlist')).toHaveLength(1);
  });

  it('offers Check ID in place of Seat for a member on the list not checked yet (decision 0503)', async () => {
    const { rpcs, router, seat } = await openForLeela(UNCHECKED);
    expect(within(seat).queryByRole('button', { name: 'Seat' })).toBeNull();
    fireEvent.click(within(seat).getByRole('button', { name: 'Check Leela Menon’s ID' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/kyc-review'));
    expect(rpcs('assign_from_waitlist')).toEqual([]);
  });

  it('still seats a number typed in place of that member', async () => {
    const { rpcs, seat } = await openForLeela({ ...UNCHECKED, replies: { seat_member: { status: 200, body: 's9' } } });
    fireEvent.change(within(seat).getByRole('textbox', { name: 'Or a mobile or member number' }), { target: { value: '42' } });
    expect(within(seat).queryByRole('button', { name: /^Check/ })).toBeNull();
    fireEvent.click(within(seat).getByRole('button', { name: 'Seat' }));
    await waitFor(() => expect(rpcs('seat_member')).toHaveLength(1));
    expect(rpcs('assign_from_waitlist')).toEqual([]);
  });

  it('tells staff who may not check to send the member to the desk, and seats nobody', async () => {
    const { rpcs, seat } = await openForLeela({ ...UNCHECKED, role: 'cashier' });
    fireEvent.click(within(seat).getByRole('button', { name: 'Seat' }));
    expect(await within(seat).findByText('This member has not finished their ID check. Send them to the front desk.')).toBeDefined();
    expect(rpcs('assign_from_waitlist')).toEqual([]);
  });
});
