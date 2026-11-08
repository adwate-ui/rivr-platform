import type { Reward } from '@rivr/contracts/promotionModel';
import { buildMemberFacts, buildPromotionTerms } from '@rivr/testing';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { computeGrant } from './grant.ts';
import { hourSteps, stepsReached, type HoursBonus } from './hourSteps.ts';
import { simulate } from './simulation.ts';

const chips = fc.integer({ min: 1, max: 2_000 }).map((fifties) => fifties * 50);
const halfHours = fc.integer({ min: 1, max: 48 }).map((halves) => halves * 30);
const hoursBonus: fc.Arbitrary<HoursBonus> = fc.oneof(
  fc.record({ amount: chips, after: halfHours }).map(({ amount, after }): HoursBonus => ({ kind: 'hours_bonus', chips: amount, afterMinutes: after })),
  fc.uniqueArray(fc.tuple(halfHours, chips), { minLength: 2, maxLength: 6, selector: ([after]) => after }).map((steps): HoursBonus => ({
    kind: 'hours_bonus', mode: 'steps', steps: steps.sort(([one], [other]) => one - other).map(([afterMinutes, amount]) => ({ afterMinutes, chips: amount })),
  })),
  fc.record({ every: halfHours.filter((after) => after <= 720), amount: chips, times: fc.option(fc.integer({ min: 1, max: 20 }), { nil: undefined }) })
    .map(({ every, amount, times }): HoursBonus => ({
      kind: 'hours_bonus', mode: 'every', everyMinutes: every, chips: amount, ...(times === undefined ? {} : { timesPerVisit: times }),
    })),
);
const played = fc.integer({ min: 0, max: 1_500 });

const stepEvent = (minutes: number, stepMinutes: number) => ({
  kind: 'hours_step' as const, key: `hours_step:v1:${String(stepMinutes)}`, at: new Date('2026-11-17T21:00:00+05:30'), memberId: 'm1', visitId: 'v1',
  tableId: 't1', stake: 'nlh_50_100', minutes, stepMinutes,
});

describe('play-time bonus step properties (owner, 8 Nov)', () => {
  it('reaches steps in rising order, none past the time played or a day, and more time never loses a step', () => {
    fc.assert(fc.property(hoursBonus, played, played, (reward, one, other) => {
      const [less, more] = one <= other ? [one, other] : [other, one];
      const reached = stepsReached(reward, more);
      expect(reached.every((step, at) => step <= more && step <= 1_440 && (at === 0 || step > (reached[at - 1] ?? 0)))).toBe(true);
      expect(reached.slice(0, stepsReached(reward, less).length)).toEqual(stepsReached(reward, less));
    }));
  });

  it('pays every so often no more times a visit than it allows', () => {
    fc.assert(fc.property(hoursBonus, played, (reward, minutes) => {
      if (!('mode' in reward) || reward.mode !== 'every') return;
      expect(stepsReached(reward, minutes).length).toBeLessThanOrEqual(reward.timesPerVisit ?? 48);
    }));
  });

  it('gives each step reached its own chips, so a visit is paid exactly the chips of its steps reached, and nothing for any other minute', () => {
    fc.assert(fc.property(hoursBonus, played, halfHours, (reward: Reward & HoursBonus, minutes, other) => {
      const steps = hourSteps(reward);
      const paid = stepsReached(reward, minutes).map((step) => computeGrant({ reward }, stepEvent(minutes, step)));
      const owed = steps.filter((step) => step.afterMinutes <= minutes).reduce((total, step) => total + step.chips, 0);
      expect(paid.reduce((total, grant) => total + (grant.ok ? grant.value.chips : 0), 0)).toBe(owed);
      if (!steps.some((step) => step.afterMinutes === other)) expect(computeGrant({ reward }, stepEvent(minutes, other))).toEqual({ ok: false, error: 'not_a_step' });
    }));
  });

  it('replays a visit once per step: last week never gives a visit more than its steps reached', () => {
    fc.assert(fc.property(hoursBonus, played, (reward, minutes) => {
      const terms = { ...buildPromotionTerms(), reward, limits: { perMember: 'per_visit' as const } };
      const closed = { kind: 'time_played' as const, key: 'hours_played:v1', at: new Date('2026-11-17T23:00:00+05:30'), memberId: 'm1', visitId: 'v1', tableId: 't1', stake: 'nlh_50_100', minutes, points: 0 };
      const run = simulate(terms, [{ event: closed, member: buildMemberFacts() }]);
      const owed = hourSteps(reward).filter((step) => step.afterMinutes <= minutes).reduce((total, step) => total + step.chips, 0);
      expect(run.chips).toBe(owed);
      expect(run.timesGiven).toBe(stepsReached(reward, minutes).length);
    }));
  });
});
