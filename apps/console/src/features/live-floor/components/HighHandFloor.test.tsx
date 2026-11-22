import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NOW, renderFloorScreen, seatRow, tableRow, type FloorApi } from './floorTestApi.tsx';
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

// The club's high hand: a royal flush 25,000, a straight flush 10,000, four of a kind 5,000; both rules, four dealt in.
const LIVE = [{
  promotion_id: 'p9', name: 'High hand bonus',
  reward: {
    kind: 'high_hand', rules: { bothHoleCards: true, shownAtShowdown: true, minPlayersDealt: 4 },
    hands: [{ hand: 'royal_flush', chips: 25_000 }, { hand: 'straight_flush', chips: 10_000 }, { hand: 'four_of_a_kind', chips: 5_000 }],
  },
}];
const hit = (more: Record<string, unknown>) => ({
  hit_id: 'h2', logged_at: '2026-11-15T19:42:00+00:00', member_id: 'm2', member_name: 'Siddharth Vaid', table_name: 'Table 3', seat: 5, hand: 'four_of_a_kind',
  rank: 'nine', chips: 5_000, logged_by: 'Aditya Malhotra', paid_count: 2, paid_chips: 15_000, ...more,
});
const HITS = [hit({}), hit({ hit_id: 'h1', member_name: 'Rhea Sood', hand: 'straight_flush', chips: 10_000 })];
// Devansh and Kavya sit at Table 2, Vidya at Table 1; nobody at Table 3.
const TABLES = [tableRow('t1', 'Table 1', { type: 'tt1' }), tableRow('t2', 'Table 2'), tableRow('t3', 'Table 3')];
const SEATS = [
  seatRow({ session: 's1', table: 't2', seat: 3, name: 'Devansh Malik' }), seatRow({ session: 's2', table: 't2', seat: 1, name: 'Kavya Rao' }),
  seatRow({ session: 's3', table: 't1', seat: 2, name: 'Vidya Chadha' }),
];
const ok = (body: unknown) => ({ status: 200, body });

function floorWith(more: Partial<FloorApi> = {}, replies: FloorApi['replies'] = {}): FloorApi {
  return { tables: TABLES, seats: SEATS, replies: { high_hand_live: ok(LIVE), high_hand_tonight: ok(HITS), ...replies }, ...more };
}

async function renderFloor(api: FloorApi, address = '/') {
  const view = renderFloorScreen(LiveFloorScreen, api, address);
  await screen.findByRole('group', { name: 'Table 1 NLH 50/100' }, { timeout: 5000 });
  return view;
}

const strip = () => screen.findByRole('region', { name: 'High hand bonus' });
const CONFIRMED = { bothHoleCards: true, shownAtShowdown: true, playersDealt: true };

/** Opens the panel from the strip and chooses Devansh at Table 2. */
async function openPanel() {
  fireEvent.click(within(await strip()).getByRole('button', { name: 'Log a high hand' }));
  const panel = within(await screen.findByRole('dialog', { name: 'Log a high hand' }));
  fireEvent.click(panel.getByRole('radio', { name: 'Table 2' }));
  fireEvent.click(panel.getByRole('radio', { name: 'Devansh Malik' }));
  return panel;
}

function confirmRules(panel: ReturnType<typeof within>) {
  for (const rule of ['Both hole cards played', 'Shown at showdown', '4 or more players dealt in']) fireEvent.click(panel.getByRole('switch', { name: rule }));
}

describe('the high hand on the Live floor (redesign RD-24)', () => {
  it('shows a strip while one runs: the hands paid tonight, their Bonus, the last hit and Log a high hand', async () => {
    const { rpcs } = await renderFloor(floorWith());
    const shown = await strip();
    await within(shown).findByText('2 hands paid tonight');
    expect(within(shown).getByText('15,000 Bonus')).toBeDefined();
    expect(within(shown).getByText('Last: Siddharth Vaid, Four Nines, 01:12')).toBeDefined();
    expect(within(shown).getByRole('button', { name: 'Log a high hand' })).toBeDefined();
    // Its own hits of tonight, as its record counts them.
    expect(rpcs('high_hand_tonight')).toEqual([{ p_venue_id: 'v1', p_limit: 50, p_promotion_id: 'p9' }]);
  });

  it('shows no strip with none running, and says so plainly when nothing was paid yet', async () => {
    await renderFloor(floorWith({}, { high_hand_live: ok([]) }));
    await waitFor(() => expect(screen.queryByRole('region', { name: 'High hand bonus' })).toBeNull());
    cleanup();
    await renderFloor(floorWith({}, { high_hand_tonight: ok([]) }));
    expect(await within(await strip()).findByText('No hands paid tonight')).toBeDefined();
    expect(within(await strip()).queryByText(/Bonus$/)).toBeNull();
  });

  it('says when the high hand could not be read, with Try again that asks again, so Log a high hand is never just missing', async () => {
    const down = { status: 503, body: { code: 'XX000', message: 'down', details: null, hint: null } };
    for (const read of ['high_hand_live', 'high_hand_tonight']) {
      const { rpcs } = await renderFloor(floorWith({}, { [read]: down }));
      const failed = (await screen.findByText('High hand bonus not loaded.')).closest('[role="alert"]');
      if (!(failed instanceof HTMLElement)) throw new Error('no alert');
      const asked = rpcs(read).length;
      fireEvent.click(within(failed).getByRole('button', { name: 'Try again' }));
      await waitFor(() => expect(rpcs(read).length).toBeGreaterThan(asked));
      cleanup();
    }
  });

  it('logs a hit: the table, a player seated at it, the hand, its rank and each rule, then the line and Pay', async () => {
    const { rpcs } = await renderFloor(floorWith());
    const panel = await openPanel();
    // Only tables with players are offered, and only the hands the promotion lists, each with its Bonus.
    expect(panel.queryByRole('radio', { name: 'Table 3' })).toBeNull();
    expect(panel.getByRole('button', { name: 'Pay' })).toHaveProperty('disabled', true);
    fireEvent.click(panel.getByRole('radio', { name: 'Four of a kind · 5,000' }));
    fireEvent.click(within(panel.getByRole('radiogroup', { name: 'Four of' })).getByRole('radio', { name: 'Jacks' }));
    // Nothing is paid until each rule is confirmed.
    expect(panel.queryByText(/^Pays /)).toBeNull();
    confirmRules(panel);
    expect(panel.getByText('Pays 5,000 Bonus to Devansh Malik now. Four Jacks, Table 2, seat 3.')).toBeDefined();
    fireEvent.click(panel.getByRole('button', { name: 'Pay 5,000 Bonus' }));
    await screen.findByText('5,000 Bonus paid to Devansh Malik for Four Jacks');
    expect(rpcs('log_high_hand')).toEqual([{
      p_table_id: 't2', p_member_id: 'm-s1', p_hand: 'four_of_a_kind', p_rank: 'jack', p_confirmed: CONFIRMED, p_request_id: expect.any(String),
    }]);
    expect(screen.queryByRole('dialog', { name: 'Log a high hand' })).toBeNull();
    // The strip reads tonight's hits again.
    await waitFor(() => expect(rpcs('high_hand_tonight').length).toBeGreaterThan(1));
  });

  it('asks no rank for a royal flush, and a straight flush its high card', async () => {
    const { rpcs } = await renderFloor(floorWith());
    const panel = await openPanel();
    fireEvent.click(panel.getByRole('radio', { name: 'Straight flush · 10,000' }));
    expect(within(panel.getByRole('radiogroup', { name: 'High card' })).getByRole('radio', { name: 'Nine' })).toBeDefined();
    fireEvent.click(panel.getByRole('radio', { name: 'Royal flush · 25,000' }));
    expect(panel.queryByRole('radiogroup', { name: 'High card' })).toBeNull();
    confirmRules(panel);
    fireEvent.click(panel.getByRole('button', { name: 'Pay 25,000 Bonus' }));
    await screen.findByText('25,000 Bonus paid to Devansh Malik for Royal flush');
    expect(rpcs('log_high_hand')).toEqual([expect.objectContaining({ p_hand: 'royal_flush', p_rank: '' })]);
  });

  it('says what the budget has left when it cannot pay, and keeps the panel open', async () => {
    const refused = { status: 400, body: { code: 'RVHHB', message: 'The budget has 2000 Bonus left', details: '2000', hint: null } };
    await renderFloor(floorWith({}, { log_high_hand: refused }));
    const panel = await openPanel();
    fireEvent.click(panel.getByRole('radio', { name: 'Royal flush · 25,000' }));
    confirmRules(panel);
    fireEvent.click(panel.getByRole('button', { name: 'Pay 25,000 Bonus' }));
    expect(await panel.findByText('Not paid. The budget has 2,000 Bonus left.')).toBeDefined();
    expect(screen.queryByText(/Bonus paid to/)).toBeNull();
  });

  it('lets a host read the strip, with no Log a high hand: only those who add Bonus by hand log a hit', async () => {
    await renderFloor(floorWith({ role: 'host' }));
    const shown = await strip();
    await within(shown).findByText('2 hands paid tonight');
    expect(within(shown).queryByRole('button', { name: 'Log a high hand' })).toBeNull();
  });

  it('opens the panel once when the promotions record sends its Log a high hand here, and clears the address', async () => {
    const { router } = await renderFloor(floorWith(), '/?log=high-hand');
    const panel = await screen.findByRole('dialog', { name: 'Log a high hand' });
    await waitFor(() => expect(router.state.location.search).toEqual({}));
    fireEvent.click(within(panel).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Log a high hand' })).toBeNull());
    // Closed, it stays closed while the strip reads again.
    await within(await strip()).findByText('2 hands paid tonight');
    expect(screen.queryByRole('dialog', { name: 'Log a high hand' })).toBeNull();
  });

  it('clears the address without opening anything while no high hand runs', async () => {
    const { router } = await renderFloor(floorWith({}, { high_hand_live: ok([]) }), '/?log=high-hand');
    await waitFor(() => expect(router.state.location.search).toEqual({}));
    expect(screen.queryByRole('dialog', { name: 'Log a high hand' })).toBeNull();
  });

  it('sends a retry as the same hit, and a changed choice as another', async () => {
    const down = { status: 503, body: { code: 'XX000', message: 'down', details: null, hint: null } };
    const { rpcs } = await renderFloor(floorWith({}, { log_high_hand: down }));
    const panel = await openPanel();
    fireEvent.click(panel.getByRole('radio', { name: 'Four of a kind · 5,000' }));
    fireEvent.click(panel.getByRole('radio', { name: 'Jacks' }));
    confirmRules(panel);
    fireEvent.click(panel.getByRole('button', { name: 'Pay 5,000 Bonus' }));
    await panel.findByText('Not paid. Try again.');
    fireEvent.click(panel.getByRole('button', { name: 'Pay 5,000 Bonus' }));
    await waitFor(() => expect(rpcs('log_high_hand')).toHaveLength(2));
    fireEvent.click(panel.getByRole('radio', { name: 'Nines' }));
    fireEvent.click(panel.getByRole('button', { name: 'Pay 5,000 Bonus' }));
    await waitFor(() => expect(rpcs('log_high_hand')).toHaveLength(3));
    const ids = rpcs('log_high_hand').map((sent) => (typeof sent === 'object' && sent !== null && 'p_request_id' in sent ? sent.p_request_id : null));
    expect(ids[0]).toEqual(expect.any(String));
    expect(ids[1]).toBe(ids[0]);
    expect(ids[2]).not.toBe(ids[0]);
  });
});
