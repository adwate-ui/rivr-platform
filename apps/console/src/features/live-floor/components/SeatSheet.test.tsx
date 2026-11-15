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

/** A member the search finds, as member_search gives them. */
const found = (count: number) => Array.from({ length: count }, (_, index) => ({
  member_id: `m${String(index + 1)}`, member_number: 1041 + index, full_name: `Arjun Player ${String(index + 1)}`, phone: null, tier_name: 'Member',
  visits: 0, last_visit_at: null,
}));

describe('Seat a player suggests members as the floor types (the owner, 15 Nov night)', () => {
  const typeIn = (seat: HTMLElement, text: string) =>
    fireEvent.change(within(seat).getByRole('textbox', { name: 'Or a name, mobile or member number' }), { target: { value: text } });

  it('lists eight at most of those the bounded search finds, and seats the one chosen with a tap', async () => {
    const { rpcs, seat } = await openForLeela({ ...FLOOR, replies: { member_search: { status: 200, body: found(10) }, seat_member: { status: 200, body: 's9' } } });
    typeIn(seat, 'arj');
    const matches = await within(seat).findByRole('radiogroup', { name: 'Members matching' });
    expect(within(matches).getAllByRole('radio')).toHaveLength(8);
    expect(rpcs('member_search').at(-1)).toEqual({ p_venue_id: 'v1', p_query: 'arj' });
    fireEvent.click(within(matches).getByRole('radio', { name: 'Arjun Player 3 · No. 1043' }));
    fireEvent.click(within(seat).getByRole('button', { name: 'Seat' }));
    await waitFor(() => expect(rpcs('seat_member')).toHaveLength(1));
    expect(rpcs('seat_member')[0]).toMatchObject({ p_member_number: 1043 });
    expect(rpcs('assign_from_waitlist')).toEqual([]);
    expect(await screen.findByText('Arjun Player 3 seated at Table 2, seat 2')).toBeDefined();
  });

  it('chooses with the keyboard: the arrow keys move along the matches, choosing each', async () => {
    const { rpcs, seat } = await openForLeela({ ...FLOOR, replies: { member_search: { status: 200, body: found(3) }, seat_member: { status: 200, body: 's9' } } });
    typeIn(seat, 'arj');
    const matches = await within(seat).findByRole('radiogroup', { name: 'Members matching' });
    fireEvent.keyDown(within(matches).getByRole('radio', { name: 'Arjun Player 1 · No. 1041' }), { key: 'ArrowRight' });
    expect(within(matches).getByRole('radio', { name: 'Arjun Player 2 · No. 1042' }).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(within(seat).getByRole('button', { name: 'Seat' }));
    await waitFor(() => expect(rpcs('seat_member')).toHaveLength(1));
    expect(rpcs('seat_member')[0]).toMatchObject({ p_member_number: 1042 });
  });

  it('lists first the members whose name, number or mobile starts with what is typed', async () => {
    const [row] = found(1);
    const named = [{ ...row, member_id: 'g1', member_number: 95, full_name: 'Girish Khanna' }, { ...row, member_id: 'i1', member_number: 7, full_name: 'Ishaan Verma' }];
    const { seat } = await openForLeela({ ...FLOOR, replies: { member_search: { status: 200, body: named } } });
    typeIn(seat, 'Ish');
    const matches = await within(seat).findByRole('radiogroup', { name: 'Members matching' });
    expect(within(matches).getAllByRole('radio').map((radio) => radio.textContent)).toEqual(['Ishaan Verma · No. 7', 'Girish Khanna · No. 95']);
  });

  it('says a name found no one, under the field and when Seat is pressed, and seats nobody', async () => {
    const { rpcs, seat } = await openForLeela({ ...FLOOR, replies: { member_search: { status: 200, body: [] } } });
    typeIn(seat, 'Zed');
    expect(await within(seat).findByText('No member found.')).toBeDefined();
    expect(within(seat).queryByRole('radiogroup', { name: 'Members matching' })).toBeNull();
    fireEvent.click(within(seat).getByRole('button', { name: 'Seat' }));
    expect(within(seat).getByRole('alert').textContent).toContain('No member found.');
    expect(rpcs('seat_member')).toEqual([]);
  });

  it('says when the search failed, and asks again with Try again', async () => {
    const { rpcs, seat } = await openForLeela({ ...FLOOR, replies: { member_search: { status: 500, body: { message: 'down' } } } });
    typeIn(seat, 'Ish');
    expect(await within(seat).findByText('Search failed.')).toBeDefined();
    const asked = rpcs('member_search').length;
    fireEvent.click(within(seat).getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(rpcs('member_search').length).toBeGreaterThan(asked));
  });

  it('empties the Bonus typed for one member when another is chosen', async () => {
    const { seat } = await openForLeela({ ...FLOOR, replies: { member_search: { status: 200, body: found(2) } } });
    typeIn(seat, 'arj');
    const matches = await within(seat).findByRole('radiogroup', { name: 'Members matching' });
    fireEvent.click(within(matches).getByRole('radio', { name: 'Arjun Player 1 · No. 1041' }));
    const bonus = within(seat).getByRole<HTMLInputElement>('textbox', { name: 'Bonus to redeem' });
    fireEvent.change(bonus, { target: { value: '1500' } });
    fireEvent.click(within(matches).getByRole('radio', { name: 'Arjun Player 2 · No. 1042' }));
    expect(bonus.value).toBe('');
    fireEvent.change(bonus, { target: { value: '500' } });
    typeIn(seat, 'arju');
    expect(bonus.value).toBe('');
  });

  it('reads the Bonus of the member chosen from the matches, and redeems it with their member number', async () => {
    const { rpcs, seat } = await openForLeela({ ...FLOOR, replies: {
      member_search: { status: 200, body: found(2) }, member_bonus: { status: 200, body: [{ bonus_paise: 150_000 }] }, seat_member: { status: 200, body: 's9' },
    } });
    typeIn(seat, 'arj');
    const matches = await within(seat).findByRole('radiogroup', { name: 'Members matching' });
    expect(within(seat).getByText('Up to their balance. Taken off when they sit.')).toBeDefined();
    fireEvent.click(within(matches).getByRole('radio', { name: 'Arjun Player 2 · No. 1042' }));
    expect(await within(seat).findByText('Has 1,500 Bonus.')).toBeDefined();
    expect(rpcs('member_bonus').at(-1)).toMatchObject({ p_member_id: 'm2' });
    fireEvent.change(within(seat).getByRole('textbox', { name: 'Bonus to redeem' }), { target: { value: '1000' } });
    fireEvent.click(within(seat).getByRole('button', { name: 'Seat' }));
    await waitFor(() => expect(rpcs('seat_member')).toHaveLength(1));
    expect(rpcs('seat_member')[0]).toMatchObject({ p_member_number: 1042, p_bonus_chips: 1000 });
  });

  it('asks for a member to be chosen when part of a name is typed and none is, and seats nobody', async () => {
    const { rpcs, seat } = await openForLeela({ ...FLOOR, replies: { member_search: { status: 200, body: found(2) } } });
    typeIn(seat, 'arj');
    await within(seat).findByRole('radiogroup', { name: 'Members matching' });
    fireEvent.click(within(seat).getByRole('button', { name: 'Seat' }));
    expect(await within(seat).findByText('Choose the member below.')).toBeDefined();
    expect(rpcs('seat_member')).toEqual([]);
  });
});

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
    fireEvent.change(within(seat).getByRole('textbox', { name: 'Or a name, mobile or member number' }), { target: { value: '42' } });
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
