import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PromotionList } from './PromotionList.tsx';
import { NAMES, renderWithApi, resetApi, TUESDAY } from './promotionsTestApi.tsx';

afterEach(resetApi);

/** A row of promotions_overview: the Tuesday bonus live, unless changed. */
function overviewRow(more: Record<string, unknown>) {
  return {
    promotion_id: 'p1', template_key: null, status: 'live', name: 'Buy-in bonus Tuesday', detail: '20% of your buy-in in bonus chips, up to 2,000 bonus chips', runs: null,
    current_version_id: 'v1', current_status: 'live', open_version_id: null, open_status: null, rejected_reason: null, reward: TUESDAY.reward,
    eligibility: TUESDAY.eligibility, schedule: TUESDAY.schedule, limits: TUESDAY.limits, channels: TUESDAY.channels, given_this_week: 38, is_legacy: false,
    created_at: '2026-11-03T10:00:00+00:00', ended_at: null, chips_given_this_week: 0, budget_used_chips: null, is_quiet: false, ...more,
  };
}

const ROWS = [
  overviewRow({}),
  overviewRow({
    promotion_id: 'p2', name: 'Weekend seat bonus', detail: '500 bonus chips on the first seat of a visit', status: 'pending', current_version_id: null, current_status: null,
    open_version_id: 'v9', open_status: 'awaiting_approval', reward: { kind: 'seat_bonus', chips: 500 },
    eligibility: { stakes: ['nlh_100_200'], tiers: 'all', audience: 'everyone' }, schedule: { ...TUESDAY.schedule, days: [5, 6], from: '20:00', to: '02:00' },
  }),
  overviewRow({ promotion_id: 'p3', name: 'Four-hour bonus', open_version_id: 'v5', open_status: 'awaiting_approval', given_this_week: 4 }),
  overviewRow({ promotion_id: 'p4', name: 'Lapsed regulars bonus', status: 'paused', detail: '500 bonus chips', runs: 'Every night',
    current_version_id: null, current_status: null, is_legacy: true, given_this_week: 3 }),
  overviewRow({ promotion_id: 'p5', name: 'Diwali seat bonus', status: 'ended', current_version_id: 'v7', current_status: 'ended',
    given_this_week: 0, ended_at: '2026-11-02T10:00:00+00:00' }),
];

function renderList(onOpen = vi.fn(), tab?: string, rows: readonly unknown[] = ROWS) {
  const onNavigate = vi.fn();
  const api = renderWithApi(<PromotionList venueId="v1" names={NAMES.names} onOpen={onOpen} tab={tab} onNavigate={onNavigate} />,
    { '/rpc/promotions_overview': { body: rows } });
  return { ...api, onOpen, onNavigate };
}

const HIGH_HAND = overviewRow({
  promotion_id: 'p9', name: 'High hand bonus', detail: 'Up to 25,000 Bonus a hand', given_this_week: 7, chips_given_this_week: 65_000, budget_used_chips: 65_000,
  reward: {
    kind: 'high_hand', rules: { bothHoleCards: true, shownAtShowdown: true, minPlayersDealt: 4 },
    hands: [{ hand: 'royal_flush', chips: 25_000 }, { hand: 'four_of_a_kind', chips: 5_000 }],
  },
  limits: { perMember: 'none', budgetChips: 200_000, budgetPeriod: 'month' },
});
const hit = (more: Record<string, unknown>) => ({
  hit_id: 'h1', logged_at: '2026-11-15T19:30:00+00:00', member_id: 'm1', member_name: 'Devansh Malik', table_name: 'Table 2', seat: 3, hand: 'four_of_a_kind',
  rank: 'jack', chips: 5_000, logged_by: 'Aditya Rao', paid_count: 2, paid_chips: 15_000, ...more,
});
const HITS = [hit({}), hit({ hit_id: 'h2', member_name: 'Rhea Sood', seat: 1, hand: 'straight_flush', rank: 'nine', chips: 10_000 })];

describe('a high hand on the promotions list (redesign RD-23)', () => {
  function renderHighHand(more: Record<string, unknown> = {}) {
    const onOpen = vi.fn();
    const onLog = vi.fn();
    const api = renderWithApi(<PromotionList venueId="v1" names={NAMES.names} onOpen={onOpen} tab={undefined} onNavigate={vi.fn()} onLogHighHand={onLog} />,
      { '/rpc/promotions_overview': { body: [{ ...HIGH_HAND, ...more }] }, '/rpc/high_hand_tonight': { body: HITS } });
    return { ...api, onOpen, onLog };
  }
  const rowOf = async () => within(await screen.findByRole('table', { name: 'Promotions' })).getAllByRole('row').find((row) => row.textContent?.includes('High hand bonus'));

  it('shows it by the most it pays, and its count as hands paid', async () => {
    renderHighHand();
    const row = await rowOf();
    expect(row?.textContent).toContain('Up to 25,000 Bonus a hand');
    expect(row?.textContent).toContain('7 hands');
    expect(row?.textContent).toContain('65,000 of 2,00,000 budget this month');
  });

  it('opens its record beside the list: paid tonight, this week and the budget left, tonight\'s hits, and Log a high hand', async () => {
    const { onOpen, onLog } = renderHighHand();
    fireEvent.click((await rowOf()) ?? document.body);
    const record = within(await screen.findByRole('dialog', { name: 'High hand bonus' }));
    expect(await record.findByText('Hands paid tonight')).toBeDefined();
    expect(record.getByText('Hands paid tonight').parentElement?.textContent).toContain('2');
    expect(record.getByText('Bonus paid tonight').parentElement?.textContent).toContain('15,000');
    expect(record.getByText('This week').parentElement?.textContent).toContain('65,000');
    expect(record.getByText('Budget left this month').parentElement?.textContent).toContain('1,35,000');
    expect(record.getByText('Four Jacks · Table 2, seat 3')).toBeDefined();
    expect(record.getByText('Straight flush, Nine high · Table 2, seat 1')).toBeDefined();
    expect(record.getByText('+10,000')).toBeDefined();
    fireEvent.click(record.getByRole('button', { name: 'Log a high hand' }));
    expect(onLog).toHaveBeenCalledOnce();
    // Its builder is one press further, from the record's own Edit.
    expect(onOpen).not.toHaveBeenCalled();
    fireEvent.click(record.getByRole('button', { name: 'Edit' }));
    expect(onOpen).toHaveBeenCalledWith('p9');
  });

  it('shows its hands and rules on the record\'s other tab, and opens the builder to change them', async () => {
    const { onOpen } = renderHighHand();
    fireEvent.click((await rowOf()) ?? document.body);
    const record = within(await screen.findByRole('dialog', { name: 'High hand bonus' }));
    fireEvent.click(record.getByRole('radio', { name: 'Hands and rules' }));
    // Only the hands it lists: a listed hand always has a Bonus (correction 11).
    expect(record.queryByText('Aces full')).toBeNull();
    expect(record.getByText('Royal flush').parentElement?.textContent).toContain('25,000');
    expect(record.getByText('Four of a kind').parentElement?.textContent).toContain('5,000');
    expect(record.getByText('Both hole cards must play').parentElement?.textContent).toContain('Yes');
    expect(record.getByText('Players dealt in').parentElement?.textContent).toContain('4 or more');
    expect(record.getByText('Where').parentElement?.textContent).toContain('All stakes');
    fireEvent.click(record.getByRole('button', { name: 'Change hands and rules' }));
    expect(onOpen).toHaveBeenCalledWith('p9');
  });

  it('offers no Log a high hand to staff who may not log one', async () => {
    renderWithApi(<PromotionList venueId="v1" names={NAMES.names} onOpen={vi.fn()} tab={undefined} onNavigate={vi.fn()} />,
      { '/rpc/promotions_overview': { body: [HIGH_HAND] }, '/rpc/high_hand_tonight': { body: [] } });
    fireEvent.click((await rowOf()) ?? document.body);
    const record = within(await screen.findByRole('dialog', { name: 'High hand bonus' }));
    expect(await record.findByText('No high hand paid tonight.')).toBeDefined();
    expect(record.queryByRole('button', { name: 'Log a high hand' })).toBeNull();
  });
});

describe('the promotions list (console v3)', () => {
  it('shows each promotion with what it gives, who, when, this week and its status, and counts each status', async () => {
    renderList();
    const table = await screen.findByRole('table', { name: 'Promotions' });
    const tuesday = within(table).getAllByRole('row').find((row) => row.textContent?.includes('Buy-in bonus Tuesday')) ?? table;
    expect(tuesday.textContent).toContain('20% of your buy-in in bonus chips, up to 2,000 bonus chips');
    expect(tuesday.textContent).toContain('All stakes');
    expect(tuesday.textContent).toContain('Tue, all day');
    expect(tuesday.textContent).toContain('38 times');
    const weekend = within(table).getAllByRole('row').find((row) => row.textContent?.includes('Weekend seat bonus')) ?? table;
    expect(weekend.textContent).toContain('NLH 100/200');
    expect(weekend.textContent).toContain('Fri, Sat 20:00–02:00');
    expect(screen.getByRole('radio', { name: 'Awaiting approval, 2' })).toBeDefined();
    expect(screen.getByRole('radio', { name: 'Live, 2' })).toBeDefined();
    expect(screen.getByRole('radio', { name: 'All, 4' }).getAttribute('aria-checked')).toBe('true');
  });

  it('lists what is live first, then what is coming, what waits, what is stopped and the drafts (audit F-104)', async () => {
    const row = (promotion_id: string, name: string, status: string) => overviewRow({ promotion_id, name, status, current_status: status });
    renderList(undefined, undefined, [row('a', 'Draft one', 'draft'), row('b', 'Paused one', 'paused'), row('c', 'Waiting one', 'awaiting_approval'),
      row('d', 'Scheduled one', 'scheduled'), row('e', 'Live one', 'live')]);
    const rows = within(await screen.findByRole('table', { name: 'Promotions' })).getAllByRole('row');
    const places = ['Live one', 'Scheduled one', 'Waiting one', 'Paused one', 'Draft one'].map((name) => rows.findIndex((one) => one.textContent?.includes(name)));
    expect(places).not.toContain(-1);
    expect(places).toEqual([...places].sort((one, other) => one - other));
  });

  it('heads the column Given this week, with the bonus chips, the times and the budget used (audit F-104)', async () => {
    renderList(undefined, undefined, [
      overviewRow({ chips_given_this_week: 12_000, budget_used_chips: 30_000, limits: { perMember: 'none', budgetChips: 50_000 } }),
      overviewRow({ promotion_id: 'p2', name: 'Weekend seat bonus', chips_given_this_week: 400, given_this_week: 1 }),
    ]);
    const table = await screen.findByRole('table', { name: 'Promotions' });
    expect(within(table).getByText('Given this week')).toBeDefined();
    const rowOf = (name: string) => within(table).getAllByRole('row').find((row) => row.textContent?.includes(name)) ?? table;
    expect(rowOf('Buy-in bonus Tuesday').textContent).toContain('12,000 bonus chips');
    expect(rowOf('Buy-in bonus Tuesday').textContent).toContain('38 times');
    expect(rowOf('Buy-in bonus Tuesday').textContent).toContain('30,000 of 50,000 budget');
    expect(rowOf('Weekend seat bonus').textContent).toContain('400 bonus chips');
    expect(rowOf('Weekend seat bonus').textContent).toContain('Once');
  });

  it('marks a live promotion that has given nothing for a week (audit F-104)', async () => {
    renderList(undefined, undefined, [overviewRow({ is_quiet: true, given_this_week: 0, open_version_id: 'v5', open_status: 'draft' })]);
    expect(await screen.findByText('Nothing given in 7 days')).toBeDefined();
    expect(screen.getByText('New version in draft')).toBeDefined();
  });

  it('shows the running version and that a new one awaits approval, and a promotion run by its rule', async () => {
    renderList();
    const table = await screen.findByRole('table', { name: 'Promotions' });
    const fourHour = within(table).getAllByRole('row').find((row) => row.textContent?.includes('Four-hour bonus')) ?? table;
    expect(fourHour.textContent).toContain('Live');
    expect(fourHour.textContent).toContain('New version awaits approval');
    expect(within(fourHour).getByRole('button', { name: 'Review Four-hour bonus' })).toBeDefined();
    expect(within(table).getAllByRole('row').find((row) => row.textContent?.includes('Lapsed regulars bonus'))?.textContent).toContain('Run by its rule');
    expect(screen.queryByRole('button', { name: 'Edit Lapsed regulars bonus' })).toBeNull();
  });

  it('lists what awaits approval under its chip: new promotions and new versions of running ones', async () => {
    renderList();
    fireEvent.click(await screen.findByRole('radio', { name: 'Awaiting approval, 2' }));
    const table = screen.getByRole('table', { name: 'Promotions' });
    expect(within(table).queryByText('Buy-in bonus Tuesday')).toBeNull();
    expect(within(table).getByText('Weekend seat bonus')).toBeDefined();
    expect(within(table).getByText('Four-hour bonus')).toBeDefined();
    fireEvent.click(screen.getByRole('radio', { name: 'Draft, 0' }));
    expect(screen.getByText('No promotions with this status.')).toBeDefined();
  });

  it('keeps ended promotions apart, under their own tab in the address, with the day each ended (owner, 8 Nov)', async () => {
    const { onNavigate } = renderList();
    const table = await screen.findByRole('table', { name: 'Promotions' });
    expect(within(table).queryByText('Diwali seat bonus')).toBeNull();
    expect(screen.getByRole('link', { name: 'Current 4' }).getAttribute('aria-current')).toBe('page');
    fireEvent.click(screen.getByRole('link', { name: 'Ended 1' }));
    expect(onNavigate).toHaveBeenCalledWith('/promotions?tab=ended');
    resetApi();
    renderList(vi.fn(), 'ended');
    // The Ended tab's table has a name, and so a view in the address, of its own (owner, 9 Nov).
    const ended = await screen.findByRole('table', { name: 'Ended promotions' });
    expect(within(ended).queryByText('Buy-in bonus Tuesday')).toBeNull();
    const diwali = within(ended).getAllByRole('row').find((row) => row.textContent?.includes('Diwali seat bonus')) ?? ended;
    expect(diwali.textContent).toContain('2 Nov 2026');
    expect(screen.queryByRole('radio', { name: 'All, 4' })).toBeNull();
  });

  it('ends a running promotion in versions after a second press; one run by its rule and a new one have no End', async () => {
    const { bodiesOf } = renderList();
    fireEvent.click(await screen.findByRole('button', { name: 'End Buy-in bonus Tuesday' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, end Buy-in bonus Tuesday' }));
    expect(await screen.findByText('Buy-in bonus Tuesday ended')).toBeDefined();
    expect(bodiesOf('end_promotion_version')).toEqual([{ p_version_id: 'v1' }]);
    expect(screen.queryByRole('button', { name: 'End Lapsed regulars bonus' })).toBeNull();
    // Its next version waits for approval: it is decided first, so the end is never undone by an approval.
    expect(screen.queryByRole('button', { name: 'End Four-hour bonus' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'End Weekend seat bonus' })).toBeNull();
  });

  it('opens a promotion to edit or review, and the builder for a new one', async () => {
    const { onOpen } = renderList();
    fireEvent.click(await screen.findByRole('button', { name: 'Edit Buy-in bonus Tuesday' }));
    fireEvent.click(screen.getByRole('button', { name: 'Review Weekend seat bonus' }));
    fireEvent.click(screen.getByRole('button', { name: 'New promotion' }));
    expect(onOpen.mock.calls).toEqual([['p1'], ['p2'], ['new']]);
  });

  it('pauses the running version, and Undo resumes it through its own call', async () => {
    const { bodiesOf } = renderList();
    fireEvent.click(await screen.findByRole('button', { name: 'Pause Buy-in bonus Tuesday' }));
    expect(await screen.findByText('Buy-in bonus Tuesday paused')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(bodiesOf('set_promotion_version_live')).toEqual([
      { p_version_id: 'v1', p_is_live: false }, { p_version_id: 'v1', p_is_live: true },
    ]));
  });

  it('resumes a promotion run by its rule through its own call', async () => {
    const { bodiesOf } = renderList();
    fireEvent.click(await screen.findByRole('button', { name: 'Resume Lapsed regulars bonus' }));
    expect(await screen.findByText('Lapsed regulars bonus resumed')).toBeDefined();
    expect(bodiesOf('set_promotion_live')).toEqual([{ p_promotion_id: 'p4', p_is_live: true }]);
  });
});
