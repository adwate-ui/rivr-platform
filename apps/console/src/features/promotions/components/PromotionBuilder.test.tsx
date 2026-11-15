import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { blankForm, formFromTerms } from './builderForm.ts';
import { PromotionBuilder, type BuilderStart } from './PromotionBuilder.tsx';
import { NAMES, refused, renderWithApi, resetApi, TUESDAY, type Reply } from './promotionsTestApi.tsx';

afterEach(resetApi);

const NEW: BuilderStart = { promotionId: null, draft: null, form: blankForm('2026-11-10'), title: 'New promotion', notice: null };
const SIMULATION = { events: 4, membersQualified: 3, timesGiven: 3, chips: 4_500, perks: 0, isBudgetReached: false };

// The calls a new draft's Save and Simulate make, answered: its version and promotion, and last week with no events.
const SAVED_AND_REPLAYED: Readonly<Record<string, Reply>> = {
  '/rpc/save_promotion_draft': { body: 'v1' },
  '/rest/v1/promotion_version': { body: [{ promotion_id: 'p1' }] },
  '/rpc/promotion_version_replay': { body: { from: '2026-11-02T00:30:00+00:00', to: '2026-11-09T00:30:00+00:00', events: [] } },
};

function renderBuilder(start: BuilderStart, replies: Readonly<Record<string, Reply>> = SAVED_AND_REPLAYED) {
  const onDone = vi.fn();
  const api = renderWithApi(
    <PromotionBuilder venueId="v1" names={NAMES} actor={{ staffId: 's1', permissions: ['promotions.manage'] }} start={start} onDone={onDone} />, replies,
  );
  return { ...api, onDone };
}

const submitButton = () => screen.getByRole('button', { name: 'Submit for approval' });

describe('the promotion builder (console v3)', () => {
  it('keeps Submit for approval until a simulation has run on the terms as they stand', async () => {
    const { bodiesOf } = renderBuilder(NEW);
    fireEvent.change(screen.getByRole('textbox', { name: 'Name members see' }), { target: { value: 'Weekend seat bonus' } });
    expect(submitButton()).toHaveProperty('disabled', true);
    expect(screen.getByText('Run it before submitting, so the approver sees what it gives.')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Simulate' }));
    expect(await screen.findByText('members qualified')).toBeDefined();
    expect(screen.getByText('2 Nov to 8 Nov')).toBeDefined();
    expect(submitButton()).toHaveProperty('disabled', false);
    expect(bodiesOf('save_promotion_draft')[0]).toMatchObject({
      p_venue_id: 'v1', p_draft: { terms: { name: 'Weekend seat bonus', reward: { kind: 'seat_bonus', chips: 1_000 } }, detail: '1,000 Bonus on the first seat of a visit' },
    });
    expect(bodiesOf('record_promotion_simulation')).toHaveLength(1);
    fireEvent.change(screen.getByRole('textbox', { name: 'Amount' }), { target: { value: '1500' } });
    expect(submitButton()).toHaveProperty('disabled', true);
  });

  it('submits the simulated draft for approval, says so and goes back to the list', async () => {
    const { bodiesOf, onDone } = renderBuilder(NEW);
    fireEvent.change(screen.getByRole('textbox', { name: 'Name members see' }), { target: { value: 'Weekend seat bonus' } });
    fireEvent.click(screen.getByRole('button', { name: 'Simulate' }));
    await waitFor(() => expect(submitButton()).toHaveProperty('disabled', false));
    fireEvent.click(submitButton());
    expect(await screen.findByText('Weekend seat bonus sent for approval')).toBeDefined();
    expect(bodiesOf('submit_promotion_version')).toEqual([{ p_version_id: 'v1' }]);
    expect(onDone).toHaveBeenCalledOnce();
  });

  it('shows the promotion in one line and on the TV slide as it is built, from a template', () => {
    renderBuilder(NEW);
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Start from' })).getByRole('radio', { name: 'Seat bonus' }));
    expect(screen.getByRole('textbox', { name: 'Name members see' })).toHaveProperty('value', 'Tuesday seat bonus');
    expect(within(screen.getByRole('radiogroup', { name: 'Reward' })).getByRole('radio', { name: 'First seat' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText(/^1,000 Bonus for the first 5 seated at a table, for all stakes, Tue, all day\./)).toBeDefined();
    expect(within(screen.getByRole('group', { name: 'TV slide' })).getByText('Tuesday seat bonus')).toBeDefined();
    expect(screen.getByRole('textbox', { name: 'Amount' })).toHaveProperty('value', '1000');
  });

  it('builds a high hand from its template: hands added and removed, each with its Bonus, and the three rules (redesign RD-23)', async () => {
    const { bodiesOf } = renderBuilder(NEW);
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Start from' })).getByRole('radio', { name: 'High hand bonus' }));
    expect(within(screen.getByRole('radiogroup', { name: 'Reward' })).getByRole('radio', { name: 'High hand' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('textbox', { name: 'Royal flush' })).toHaveProperty('value', '25000');
    expect(screen.getByText(/^Royal flush 25,000, Straight flush 10,000, Four of a kind 5,000 Bonus, paid each time, for all stakes, every day, all day\. No limit per member, budget 2,00,000 Bonus a month\./)).toBeDefined();
    // A hand just added has no Bonus yet: nothing is saved, and the list says why.
    fireEvent.click(within(screen.getByRole('group', { name: 'Add a hand' })).getByRole('button', { name: 'Aces full' }));
    fireEvent.click(screen.getByRole('button', { name: 'Simulate' }));
    expect(await screen.findByText('Each hand needs its Bonus, in whole 50s.')).toBeDefined();
    expect(bodiesOf('save_promotion_draft')).toHaveLength(0);
    fireEvent.change(screen.getByRole('textbox', { name: 'Aces full' }), { target: { value: '2000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Remove Four of a kind' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Shown at showdown' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Players dealt in, at least' }), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Simulate' }));
    await waitFor(() => expect(bodiesOf('save_promotion_draft')).toHaveLength(1));
    expect(bodiesOf('save_promotion_draft')[0]).toMatchObject({
      p_draft: {
        terms: {
          reward: {
            kind: 'high_hand', rules: { bothHoleCards: true, shownAtShowdown: false, minPlayersDealt: 5 },
            hands: [{ hand: 'royal_flush', chips: 25_000 }, { hand: 'straight_flush', chips: 10_000 }, { hand: 'aces_full', chips: 2_000 }],
          },
          limits: { perMember: 'none', budgetChips: 200_000, budgetPeriod: 'month' },
        },
        detail: 'Up to 25,000 Bonus a hand',
      },
    });
  });

  it('asks a high hand for its budget, and says so when another high hand promotion runs', async () => {
    renderBuilder(NEW, { ...SAVED_AND_REPLAYED, '/rpc/submit_promotion_version': refused('RVHH1') });
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Start from' })).getByRole('radio', { name: 'High hand bonus' }));
    // Paid every time, so no limit a member or a day is asked.
    expect(screen.queryByRole('radiogroup', { name: 'Each member' })).toBeNull();
    expect(screen.queryByRole('textbox', { name: 'Most members a day' })).toBeNull();
    fireEvent.change(screen.getByRole('textbox', { name: 'Budget' }), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Simulate' }));
    expect(await screen.findByText('A high hand needs a budget, in whole 50s.')).toBeDefined();
    fireEvent.change(screen.getByRole('textbox', { name: 'Budget' }), { target: { value: '100000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Simulate' }));
    await waitFor(() => expect(submitButton()).toHaveProperty('disabled', false));
    fireEvent.click(submitButton());
    expect(await screen.findByText('Another high hand promotion is running. End it first.')).toBeDefined();
  });

  it('offers no buy-in bonus, cab home or tournament entry: nothing could pay them (audit F-005, F-033)', () => {
    renderBuilder(NEW);
    const rewards = within(screen.getByRole('radiogroup', { name: 'Reward' }));
    for (const gone of ['Buy-in bonus', 'Cab home', 'Tournament entry']) expect(rewards.queryByRole('radio', { name: gone })).toBeNull();
    const templates = within(screen.getByRole('radiogroup', { name: 'Start from' }));
    for (const gone of ['Buy-in bonus', 'Cab home']) expect(templates.queryByRole('radio', { name: gone })).toBeNull();
  });

  it('builds a play-time bonus at set times, a step at a time, or every so often (owner, 8 Nov)', () => {
    renderBuilder(NEW);
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Reward' })).getByRole('radio', { name: 'Hours played' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add a step' }));
    expect(screen.getByRole('textbox', { name: 'Then Bonus' })).toHaveProperty('value', '1000');
    expect(screen.getByText(/^1,000 Bonus after 4 hours, then 1,000 after 6 hours, for all stakes/)).toBeDefined();
    // Steps keep their place (owner, 9 Nov: "Lock step count"): only the last is removed, and the builder says why.
    fireEvent.click(screen.getByRole('button', { name: 'Add a step' }));
    expect(screen.queryByRole('button', { name: 'Remove step 2' })).toBeNull();
    expect(screen.getByText('Steps keep their place: add or remove them at the end. To reorder, end this promotion and start a new one.')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Remove step 3' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove step 2' }));
    expect(screen.queryByRole('textbox', { name: 'Then Bonus' })).toBeNull();
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Pays' })).getByRole('radio', { name: 'Every few hours' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Times a visit' }), { target: { value: '3' } });
    expect(screen.getByText(/^1,000 Bonus every 2 hours, up to 3 times a visit, for all stakes/)).toBeDefined();
  });

  // Decision 0580: the first members to claim it get one amount, the next another, once a member.
  it('builds a seat bonus in tiers, a tier at a time, and says how they count', () => {
    renderBuilder(NEW);
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Reward' })).getByRole('radio', { name: 'First seat' }));
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Pays' })).getByRole('radio', { name: 'In tiers' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Tier 1: the first' }), { target: { value: '10' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Tier 1 Bonus' }), { target: { value: '5000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add a tier' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Tier 2: the next' }), { target: { value: '20' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Tier 2 Bonus' }), { target: { value: '2000' } });
    expect(screen.getByText(/^Bonus on a first seat, once a member: first 10 get 5,000, next 20 get 2,000, for all stakes/)).toBeDefined();
    expect(screen.getByText(/^Each member gets it once, on a first seat\./)).toBeDefined();
    // Limits hold to once a member: no other period, no times, no month (the review of #909).
    const perMember = within(screen.getByRole('radiogroup', { name: 'Each member' }));
    expect(perMember.getAllByRole('radio').map((radio) => radio.textContent)).toEqual(['Once ever']);
    expect(perMember.getByRole('radio', { name: 'Once ever' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.queryByRole('textbox', { name: 'Up to how many times' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Remove tier 1' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Remove tier 2' }));
    expect(screen.queryByRole('textbox', { name: 'Tier 2: the next' })).toBeNull();
    expect(screen.getByText(/^Bonus on a first seat, once a member: first 10 get 5,000, for all stakes/)).toBeDefined();
  });

  it('marks the fields the terms refuse and sends nothing', async () => {
    const { calls } = renderBuilder(NEW);
    fireEvent.change(screen.getByRole('textbox', { name: 'Amount' }), { target: { value: '1020' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(await screen.findByText('Name it in 3 to 80 characters.')).toBeDefined();
    expect(screen.getByText('Whole 50s, from 50.')).toBeDefined();
    expect(screen.getAllByText('Not saved. Check the fields marked.').length).toBeGreaterThan(0);
    expect(calls.filter((call) => call.url.includes('/rpc/'))).toEqual([]);
  });

  it('submits a draft whose stored simulation holds for its terms, without saving or simulating again', async () => {
    const draft = { versionId: 'v4', terms: TUESDAY, simulation: SIMULATION };
    const { bodiesOf, calls } = renderBuilder({ promotionId: 'p1', draft, form: formFromTerms(TUESDAY), title: 'Edit', notice: null });
    expect(screen.getByText('4,500')).toBeDefined();
    fireEvent.click(submitButton());
    await waitFor(() => expect(bodiesOf('submit_promotion_version')).toEqual([{ p_version_id: 'v4' }]));
    expect(calls.filter((call) => call.url.includes('save_promotion_draft') || call.url.includes('replay'))).toEqual([]);
  });

  it('saves a change to a running promotion as its next version, and says why a save is refused', async () => {
    const { bodiesOf } = renderBuilder({ promotionId: 'p1', draft: null, form: formFromTerms(TUESDAY), title: 'Edit', notice: 'Changes make version 2.' }, {
      '/rpc/save_promotion_draft': refused('RVFRZ'),
    });
    expect(screen.getByText('Changes make version 2.')).toBeDefined();
    fireEvent.change(screen.getByRole('textbox', { name: 'Amount' }), { target: { value: '1500' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(await screen.findByText('Venue frozen. Try again once it is released.')).toBeDefined();
    expect(bodiesOf('save_promotion_draft')[0]).toMatchObject({ p_promotion_id: 'p1', p_draft: { terms: { reward: { chips: 1_500 } } } });
  });
});
