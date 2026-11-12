import { cleanup, fireEvent, screen, within } from '@testing-library/react';
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

// Two open tables, and Leela waiting for Table 2.
const FLOOR: FloorApi = {
  tables: [tableRow('t1', 'Table 1', { type: 'tt1' }), tableRow('t2', 'Table 2')],
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

/** The seat sheet's bonus chips (decision 0504), and the cap on what one visit redeems (decision 0579). */
describe('Seat a player › bonus chips', () => {
  it('shows the chosen member’s bonus chips and redeems them with the seat, with no Undo (decision 0504)', async () => {
    const { rpcs } = await renderFloor({ ...FLOOR, replies: { member_bonus: { status: 200, body: [{ bonus_paise: 150_000 }] } } });
    fireEvent.click(within(tile('Table 2 NLH 100/200')).getByRole('button', { name: 'Seat 2, Open' }));
    const seat = await sheet('Seat a player');
    await within(seat).findByRole('radio', { name: 'Leela Menon · 12 min' });
    expect(await within(seat).findByText('Has 1,500 bonus chips.')).toBeDefined();
    fireEvent.change(within(seat).getByRole('textbox', { name: 'Bonus chips to redeem' }), { target: { value: '25' } });
    fireEvent.click(within(seat).getByRole('button', { name: 'Seat' }));
    expect(within(seat).getByText('Bonus chips go in whole 50s.')).toBeDefined();
    fireEvent.change(within(seat).getByRole('textbox', { name: 'Bonus chips to redeem' }), { target: { value: '1000' } });
    fireEvent.click(within(seat).getByRole('button', { name: 'Seat' }));
    await screen.findByText('Leela Menon seated at Table 2, seat 2');
    expect(rpcs('assign_from_waitlist')).toEqual([{ p_entry_id: 'e7', p_table_id: 't2', p_seat: 2, p_call_minutes: 180, p_bonus_chips: 1000 }]);
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
  });

  // Decision 0579: the club caps what one visit redeems.
  it('shows what this visit may still redeem, and says when a seat asks for more', async () => {
    await renderFloor({ ...FLOOR, replies: {
      member_bonus: { status: 200, body: [{ bonus_paise: 150_000 }] },
      member_bonus_visit_left: { status: 200, body: [{ left_paise: 50_000 }] },
      assign_from_waitlist: { status: 400, body: { code: 'RVVCP', message: 'cap' } },
    } });
    fireEvent.click(within(tile('Table 2 NLH 100/200')).getByRole('button', { name: 'Seat 2, Open' }));
    const seat = await sheet('Seat a player');
    await within(seat).findByRole('radio', { name: 'Leela Menon · 12 min' });
    expect(await within(seat).findByText('Has 1,500 bonus chips. Up to 500 this visit.')).toBeDefined();
    fireEvent.change(within(seat).getByRole('textbox', { name: 'Bonus chips to redeem' }), { target: { value: '1000' } });
    fireEvent.click(within(seat).getByRole('button', { name: 'Seat' }));
    expect(await screen.findByText('More bonus chips than this visit allows. Not seated.')).toBeDefined();
  });

  it('says why bonus chips were not redeemed, and seats nobody', async () => {
    await renderFloor({ ...FLOOR, replies: { seat_member: { status: 400, body: { code: 'RVBON', message: 'short' } } } });
    fireEvent.click(within(tile('Table 1 NLH 50/100')).getByRole('button', { name: 'Seat 4, Open' }));
    const seat = await sheet('Seat a player');
    expect(within(seat).getByText('Up to their balance. Taken off when they sit.')).toBeDefined();
    fireEvent.change(within(seat).getByRole('textbox', { name: 'Mobile or member number' }), { target: { value: '42' } });
    fireEvent.change(within(seat).getByRole('textbox', { name: 'Bonus chips to redeem' }), { target: { value: '5000' } });
    fireEvent.click(within(seat).getByRole('button', { name: 'Seat' }));
    expect(await screen.findByText('More bonus chips than the member has. Not seated.')).toBeDefined();
  });
});
