import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PromotionList } from './PromotionList.tsx';
import { NAMES, renderWithApi, resetApi, TUESDAY } from './promotionsTestApi.tsx';

afterEach(resetApi);

/** A row of promotions_overview: the Tuesday bonus live, unless changed. */
function overviewRow(more: Record<string, unknown>) {
  return {
    promotion_id: 'p1', template_key: null, status: 'live', name: 'Buy-in bonus Tuesday', detail: '20% buy-in bonus, up to 2,000', runs: null,
    current_version_id: 'v1', current_status: 'live', open_version_id: null, open_status: null, rejected_reason: null, reward: TUESDAY.reward,
    eligibility: TUESDAY.eligibility, schedule: TUESDAY.schedule, limits: TUESDAY.limits, channels: TUESDAY.channels, given_this_week: 38, is_legacy: false,
    created_at: '2026-11-03T10:00:00+00:00', ...more,
  };
}

const ROWS = [
  overviewRow({}),
  overviewRow({
    promotion_id: 'p2', name: 'Weekend triple points', detail: '3× points', status: 'pending', current_version_id: null, current_status: null,
    open_version_id: 'v9', open_status: 'awaiting_approval', reward: { kind: 'points_multiplier', multiplier: 3 },
    eligibility: { stakes: ['nlh_100_200'], tiers: 'all', audience: 'everyone' }, schedule: { ...TUESDAY.schedule, days: [5, 6], from: '20:00', to: '02:00' },
  }),
  overviewRow({ promotion_id: 'p3', name: 'Four-hour bonus', open_version_id: 'v5', open_status: 'awaiting_approval', given_this_week: 4 }),
  overviewRow({ promotion_id: 'p4', name: 'Lapsed regulars bonus', status: 'paused', detail: '500 bonus chips', runs: 'Every night',
    current_version_id: null, current_status: null, is_legacy: true, given_this_week: 3 }),
];

function renderList(onOpen = vi.fn()) {
  const api = renderWithApi(<PromotionList venueId="v1" names={NAMES.names} onOpen={onOpen} />, { '/rpc/promotions_overview': { body: ROWS } });
  return { ...api, onOpen };
}

describe('the promotions list (console v3)', () => {
  it('shows each promotion with what it gives, who, when, this week and its status, and counts each status', async () => {
    renderList();
    const table = await screen.findByRole('table', { name: 'Promotions' });
    const tuesday = within(table).getAllByRole('row').find((row) => row.textContent?.includes('Buy-in bonus Tuesday')) ?? table;
    expect(tuesday.textContent).toContain('20% buy-in bonus, up to 2,000');
    expect(tuesday.textContent).toContain('All stakes');
    expect(tuesday.textContent).toContain('Tue, all day');
    expect(tuesday.textContent).toContain('38');
    const weekend = within(table).getAllByRole('row').find((row) => row.textContent?.includes('Weekend triple points')) ?? table;
    expect(weekend.textContent).toContain('NLH 100/200');
    expect(weekend.textContent).toContain('Fri, Sat 20:00–02:00');
    expect(screen.getByRole('radio', { name: 'Awaiting approval, 2' })).toBeDefined();
    expect(screen.getByRole('radio', { name: 'Live, 2' })).toBeDefined();
    expect(screen.getByRole('radio', { name: 'All, 4' }).getAttribute('aria-checked')).toBe('true');
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
    expect(within(table).getByText('Weekend triple points')).toBeDefined();
    expect(within(table).getByText('Four-hour bonus')).toBeDefined();
    fireEvent.click(screen.getByRole('radio', { name: 'Ended, 0' }));
    expect(screen.getByText('No promotions with this status.')).toBeDefined();
  });

  it('opens a promotion to edit or review, and the builder for a new one', async () => {
    const { onOpen } = renderList();
    fireEvent.click(await screen.findByRole('button', { name: 'Edit Buy-in bonus Tuesday' }));
    fireEvent.click(screen.getByRole('button', { name: 'Review Weekend triple points' }));
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
