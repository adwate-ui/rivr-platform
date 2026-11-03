import { approverViewOf, type PromotionVersionView } from '@rivr/db';
import type { Actor } from '@rivr/domain/promotions';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PromotionReview } from './PromotionReview.tsx';
import { NAMES, renderWithApi, resetApi, TUESDAY } from './promotionsTestApi.tsx';

afterEach(resetApi);

const SIMULATION = { events: 9, membersQualified: 6, timesGiven: 8, points: 0, chips: 12_000, spins: 0, perks: 0, isBudgetReached: true };

/** A version as promotion_versions_of gives it: the Tuesday bonus, live, unless changed. */
function version(more: Partial<PromotionVersionView>): PromotionVersionView {
  return {
    id: 'v1', version: 1, status: 'live', terms: TUESDAY, detail: null, runs: null, author: 'Ishita Bose', isMine: false,
    submittedAt: '2026-11-02T10:00:00+00:00', decidedBy: 'Vikram Rao', decidedAt: '2026-11-02T11:00:00+00:00', rejectedReason: null, simulation: null, ...more,
  };
}

const RAISED = { ...TUESDAY, reward: { ...TUESDAY.reward, percent: 25 }, schedule: { ...TUESDAY.schedule, days: [2, 3] } };
const WAITING = version({ id: 'v2', version: 2, status: 'awaiting_approval', terms: RAISED, simulation: SIMULATION, submittedAt: '2026-11-03T09:00:00+00:00' });
const APPROVER: Actor = { staffId: 's9', permissions: ['promotions.manage', 'promotions.approve'] };

/** Last Tuesday's buy-ins of 10,000 and 5,000 of own chips, as promotion_version_replay gives them. */
const REPLAY = {
  from: '2026-10-27T00:30:00+00:00', to: '2026-11-03T00:30:00+00:00',
  events: [10_000, 5_000].map((ownChips, n) => ({
    event: { kind: 'buy_in', key: `buy_in:${String(n)}`, at: `2026-10-27T2${String(n)}:00:00+05:30`, memberId: `m${String(n)}`, visitId: `v${String(n)}`,
      tableId: 't1', stake: 'nlh_50_100', ownChips, isFirstOfVisit: true },
    member: { tierId: null, daysSinceJoined: 40, daysSinceLastVisit: 3 },
  })),
};

function renderReview(versions: PromotionVersionView[], actor: Actor = APPROVER) {
  const view = approverViewOf(versions);
  const onDone = vi.fn();
  if (view.waiting === null) throw new Error('A version must wait in these tests');
  const api = renderWithApi(<PromotionReview venueId="v1" names={NAMES} actor={actor} view={{ ...view, waiting: view.waiting }} onDone={onDone} />,
    { '/rpc/promotion_version_replay': { body: REPLAY } });
  return { ...api, onDone };
}

describe("the approver's view (console v3)", () => {
  it('reads the waiting version against the live one: what changes, marked on its sections, and both in one line', () => {
    renderReview([WAITING, version({})]);
    expect(screen.getByRole('heading', { level: 1, name: 'Review: Buy-in bonus Tuesday' })).toBeDefined();
    expect(screen.getByText('Changes from version 1: reward, when.')).toBeDefined();
    expect(within(screen.getByRole('region', { name: '1 · Reward' })).getByText('Changed')).toBeDefined();
    expect(within(screen.getByRole('region', { name: '3 · When' })).getByText('Changed')).toBeDefined();
    expect(within(screen.getByRole('region', { name: '2 · Who qualifies' })).queryByText('Changed')).toBeNull();
    expect(screen.getByText('Version 1 now')).toBeDefined();
    expect(screen.getByText(/^25% buy-in bonus, up to 2,000, first 5 buy-ins per table, for all stakes, Tue, Wed, all day\./)).toBeDefined();
    expect(screen.getByText(/^20% buy-in bonus, up to 2,000, first 5 buy-ins per table, for all stakes, Tue, all day\./)).toBeDefined();
    expect(screen.getByRole('textbox', { name: 'Bonus' })).toHaveProperty('readOnly', true);
    // Read only, each choice shows only what is chosen.
    const kinds = within(screen.getByRole('radiogroup', { name: 'Reward' })).getAllByRole('radio');
    expect(kinds.map((kind) => [kind.getAttribute('aria-label'), kind.getAttribute('aria-checked')])).toEqual([['Buy-in bonus', 'true']]);
    expect(within(screen.getByRole('group', { name: 'Days' })).getAllByRole('button').map((day) => day.textContent)).toEqual(['Tue', 'Wed']);
    expect(screen.queryByRole('button', { name: 'Every day' })).toBeNull();
    expect(screen.getByText('Version 2, submitted by Ishita Bose, Tue 3 Nov, 14:30.')).toBeDefined();
  });

  it('replays last week afresh for the approver, never showing the figures stored with the version', async () => {
    const { bodiesOf } = renderReview([WAITING, version({})]);
    // 25% of 10,000 held to 2,000, and 25% of 5,000: 3,250 bonus chips; the stored 12,000 is the author's browser's.
    expect(await screen.findByText('3,250')).toBeDefined();
    expect(screen.getByText('27 Oct to 2 Nov')).toBeDefined();
    expect(screen.queryByText('12,000')).toBeNull();
    expect(screen.queryByText('The budget would have run out.')).toBeNull();
    expect(bodiesOf('promotion_version_replay')).toEqual([{ p_version_id: 'v2' }]);
    expect(bodiesOf('record_promotion_simulation')).toEqual([]);
  });

  it('approves a version for a second staff member, says it is live and goes back to the list', async () => {
    const { bodiesOf, onDone } = renderReview([WAITING, version({})]);
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    expect(await screen.findByText('Buy-in bonus Tuesday is live')).toBeDefined();
    expect(bodiesOf('approve_promotion_version')).toEqual([{ p_version_id: 'v2' }]);
    expect(onDone).toHaveBeenCalledOnce();
  });

  it('never lets the one who submitted or changed it approve it, and says why', () => {
    renderReview([{ ...WAITING, isMine: true }, version({})]);
    expect(screen.getByRole('button', { name: 'Approve' })).toHaveProperty('disabled', true);
    expect(screen.getByText('You submitted or changed this version, so another super admin approves it.')).toBeDefined();
  });

  it('sends it back with a reason of 3 to 300 characters, the rule shown before it is sent', async () => {
    const { bodiesOf } = renderReview([WAITING]);
    expect(screen.getByText('A new promotion. Nothing runs yet.')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Reject' }));
    expect(screen.getByText('3 to 300 characters. The author reads it.')).toBeDefined();
    fireEvent.change(screen.getByRole('textbox', { name: 'Why it goes back' }), { target: { value: 'no' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send back' }));
    expect(await screen.findByText('Say why, in 3 to 300 characters.')).toBeDefined();
    expect(bodiesOf('reject_promotion_version')).toEqual([]);
    fireEvent.change(screen.getByRole('textbox', { name: 'Why it goes back' }), { target: { value: 'Too generous on a Wednesday' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send back' }));
    expect(await screen.findByText('Buy-in bonus Tuesday sent back to draft')).toBeDefined();
    expect(bodiesOf('reject_promotion_version')).toEqual([{ p_version_id: 'v2', p_reason: 'Too generous on a Wednesday' }]);
  });

  it('shows staff without the approval permission who approves it, with no decision to make', () => {
    renderReview([WAITING], { staffId: 's1', permissions: ['promotions.manage'] });
    expect(screen.getByText('A super admin approves it.')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Reject' })).toBeNull();
  });

  it('says when a version starts on a later day once approved', async () => {
    const later = { ...RAISED, schedule: { ...RAISED.schedule, startsOn: '2099-01-05' } };
    renderReview([{ ...WAITING, terms: later }]);
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(screen.getByText(/^Buy-in bonus Tuesday starts /)).toBeDefined());
  });
});
