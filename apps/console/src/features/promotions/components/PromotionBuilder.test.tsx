import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { blankForm, formFromTerms } from './builderForm.ts';
import { PromotionBuilder, type BuilderStart } from './PromotionBuilder.tsx';
import { NAMES, refused, renderWithApi, resetApi, TUESDAY, type Reply } from './promotionsTestApi.tsx';

afterEach(resetApi);

const NEW: BuilderStart = { promotionId: null, draft: null, form: blankForm('2026-11-10'), title: 'New promotion', notice: null };
const SIMULATION = { events: 4, membersQualified: 3, timesGiven: 3, points: 0, chips: 4_500, spins: 0, perks: 0, isBudgetReached: false };

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
    fireEvent.change(screen.getByRole('textbox', { name: 'Name members see' }), { target: { value: 'Weekend double points' } });
    expect(submitButton()).toHaveProperty('disabled', true);
    expect(screen.getByText('Run it before submitting, so the approver sees what it gives.')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Simulate' }));
    expect(await screen.findByText('members qualified')).toBeDefined();
    expect(screen.getByText('2 Nov to 8 Nov')).toBeDefined();
    expect(submitButton()).toHaveProperty('disabled', false);
    expect(bodiesOf('save_promotion_draft')[0]).toMatchObject({
      p_venue_id: 'v1', p_draft: { terms: { name: 'Weekend double points', reward: { kind: 'points_multiplier', multiplier: 2 } }, detail: '2× points' },
    });
    expect(bodiesOf('record_promotion_simulation')).toHaveLength(1);
    fireEvent.change(screen.getByRole('textbox', { name: 'Multiplier' }), { target: { value: '3' } });
    expect(submitButton()).toHaveProperty('disabled', true);
  });

  it('submits the simulated draft for approval, says so and goes back to the list', async () => {
    const { bodiesOf, onDone } = renderBuilder(NEW);
    fireEvent.change(screen.getByRole('textbox', { name: 'Name members see' }), { target: { value: 'Weekend double points' } });
    fireEvent.click(screen.getByRole('button', { name: 'Simulate' }));
    await waitFor(() => expect(submitButton()).toHaveProperty('disabled', false));
    fireEvent.click(submitButton());
    expect(await screen.findByText('Weekend double points sent for approval')).toBeDefined();
    expect(bodiesOf('submit_promotion_version')).toEqual([{ p_version_id: 'v1' }]);
    expect(onDone).toHaveBeenCalledOnce();
  });

  it('shows the promotion in one line and on the TV slide as it is built, from a template', () => {
    renderBuilder(NEW);
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Start from' })).getByRole('radio', { name: 'Buy-in bonus' }));
    expect(screen.getByRole('textbox', { name: 'Name members see' })).toHaveProperty('value', 'Buy-in bonus Tuesday');
    expect(within(screen.getByRole('radiogroup', { name: 'Reward' })).getByRole('radio', { name: 'Buy-in bonus' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText(/^20% buy-in bonus, up to 2,000, first 5 buy-ins per table, for all stakes, Tue, all day\./)).toBeDefined();
    expect(within(screen.getByRole('group', { name: 'TV slide' })).getByText('Buy-in bonus Tuesday')).toBeDefined();
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Bonus as' })).getByRole('radio', { name: 'Fixed chips' }));
    expect(screen.getByRole('textbox', { name: 'Bonus chips' })).toHaveProperty('value', '1000');
  });

  it('builds a play-time bonus at set times, a step at a time, or every so often (owner, 8 Nov)', () => {
    renderBuilder(NEW);
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Reward' })).getByRole('radio', { name: 'Hours-played bonus' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add a step' }));
    expect(screen.getByRole('textbox', { name: 'Then bonus chips' })).toHaveProperty('value', '1000');
    expect(screen.getByText(/^1,000 bonus chips after 4 hours, then 1,000 after 6 hours, for all stakes/)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Remove step 2' }));
    expect(screen.queryByRole('textbox', { name: 'Then bonus chips' })).toBeNull();
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Pays' })).getByRole('radio', { name: 'Every few hours' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Most times a visit' }), { target: { value: '3' } });
    expect(screen.getByText(/^1,000 bonus chips every 2 hours, up to 3 times a visit, for all stakes/)).toBeDefined();
  });

  it('marks the fields the terms refuse and sends nothing', async () => {
    const { calls } = renderBuilder(NEW);
    fireEvent.change(screen.getByRole('textbox', { name: 'Multiplier' }), { target: { value: '2.1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(await screen.findByText('Name it in 3 to 80 characters.')).toBeDefined();
    expect(screen.getByText('1.25 to 5, in quarters.')).toBeDefined();
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
    fireEvent.change(screen.getByRole('textbox', { name: 'Bonus' }), { target: { value: '25' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(await screen.findByText('Venue frozen. Try again once it is released.')).toBeDefined();
    expect(bodiesOf('save_promotion_draft')[0]).toMatchObject({ p_promotion_id: 'p1', p_draft: { terms: { reward: { percent: 25 } } } });
  });
});
