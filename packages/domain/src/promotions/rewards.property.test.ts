import type { Limits, Reward } from '@rivr/contracts/promotionModel';
import { buildMemberFacts, buildPromotionTerms } from '@rivr/testing';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { computeGrant, triggerOf, type Grant, type PromotionEvent } from './grant.ts';
import { clubDay } from '../clubDay/clubDay.ts';
import { checkLimits, remainingBudget, tallyFor, type LedgerEntry } from './limits.ts';
import { simulate } from './simulation.ts';
import { stackGrants } from './stacking.ts';

const chips = fc.integer({ min: 1, max: 2_000 }).map((fifties) => fifties * 50);
const minutes = fc.integer({ min: 1, max: 48 }).map((halves) => halves * 30);
const reward: fc.Arbitrary<Reward> = fc.oneof(
  fc.integer({ min: 5, max: 20 }).map((quarters): Reward => ({ kind: 'points_multiplier', multiplier: quarters / 4 })),
  fc.record({ percent: fc.integer({ min: 1, max: 100 }), cap: fc.option(chips, { nil: undefined }), firstN: fc.option(fc.integer({ min: 1, max: 5 }), { nil: undefined }) })
    .map(({ percent, cap, firstN }): Reward => ({
      kind: 'buyin_bonus', mode: 'percent', percent, ...(cap === undefined ? {} : { capChips: cap }), ...(firstN === undefined ? {} : { firstNBuyinsPerTable: firstN }),
    })),
  chips.map((amount): Reward => ({ kind: 'buyin_bonus', mode: 'fixed', chips: amount })),
  fc.record({ amount: chips, after: minutes }).map(({ amount, after }): Reward => ({ kind: 'hours_bonus', chips: amount, afterMinutes: after })),
  fc.record({ amount: chips, on: fc.constantFrom('visit', 'first_buyin', 'referral', 'signup' as const) })
    .map(({ amount, on }): Reward => ({ kind: 'bonus_chips', chips: amount, on })),
  fc.record({ spins: fc.integer({ min: 1, max: 10 }), after: minutes }).map(({ spins, after }): Reward => ({ kind: 'free_spin', spins, afterMinutes: after })),
  fc.integer({ min: 1, max: 31 }).map((visit): Reward => ({ kind: 'cab_home', fromVisitInMonth: visit })),
  fc.constant<Reward>({ kind: 'tournament_entry', tournamentId: 'RIVR Sunday' }),
  fc.constant<Reward>({ kind: 'waitlist_priority' }),
);

// A week of the launch fortnight, by five members at two tables.
const LAUNCH_MS = Date.parse('2026-11-16T06:00:00+05:30');
const place = fc.record({
  key: fc.uuid(),
  at: fc.integer({ min: 0, max: 7 * 1_440 }).map((minute) => new Date(LAUNCH_MS + minute * 60_000)),
  memberId: fc.constantFrom('m1', 'm2', 'm3', 'm4', 'm5'),
  visitId: fc.constantFrom('v1', 'v2', null),
  tableId: fc.constantFrom('t1', 't2', null),
  stake: fc.constant('nlh_50_100'),
});
const event: fc.Arbitrary<PromotionEvent> = fc.tuple(place, fc.oneof(
  fc.record({ kind: fc.constant('buy_in' as const), ownChips: fc.integer({ min: 0, max: 100_000 }), isFirstOfVisit: fc.boolean() }),
  fc.record({ kind: fc.constant('time_played' as const), minutes: fc.integer({ min: 0, max: 900 }), points: fc.integer({ min: 0, max: 5_000 }) }),
  fc.record({ kind: fc.constant('visit' as const), visitInMonth: fc.integer({ min: 1, max: 31 }) }),
  fc.record({ kind: fc.constantFrom('referral' as const, 'signup' as const) }),
)).map(([where, facts]) => ({ ...where, ...facts }));
// Up to N times a member only with a period, and a monthly budget only with a budget or most grants (decision 0499).
const limits: fc.Arbitrary<Limits> = fc.record({
  perMember: fc.constantFrom('none', 'per_visit', 'per_day', 'per_week', 'once' as const),
  timesPerMember: fc.option(fc.integer({ min: 2, max: 4 }), { nil: undefined }),
  maxMembersPerDay: fc.option(fc.integer({ min: 1, max: 4 }), { nil: undefined }),
  budgetChips: fc.option(chips, { nil: undefined }),
  maxGrants: fc.option(fc.integer({ min: 1, max: 10 }), { nil: undefined }),
  budgetPeriod: fc.option(fc.constant('month' as const), { nil: undefined }),
}, { requiredKeys: ['perMember'] }).map(({ timesPerMember, budgetPeriod, ...rest }): Limits => ({
  ...rest,
  ...(timesPerMember === undefined || rest.perMember === 'none' ? {} : { timesPerMember }),
  ...(budgetPeriod === undefined || (rest.budgetChips === undefined && rest.maxGrants === undefined) ? {} : { budgetPeriod }),
}));
const grant: fc.Arbitrary<Grant> = fc.record({
  points: fc.nat({ max: 1_000 }), chips: fc.nat({ max: 200 }).map((fifties) => fifties * 50), spins: fc.nat({ max: 3 }),
  perk: fc.constantFrom(null, 'cab_home' as const, 'waitlist_priority' as const),
});
const ledger: fc.Arbitrary<LedgerEntry[]> = fc.array(fc.tuple(grant, fc.constantFrom('m1', 'm2'), fc.constantFrom('2026-11-16', '2026-11-17')).map(
  ([given, memberId, clubDay]) => ({ ...given, memberId, clubDay, periodKey: `day:${clubDay}`, tableId: 't1' }),
), { maxLength: 8 });

describe('promotion reward properties', () => {
  it('never gives a negative grant, and gives only for its own kind of event', () => {
    fc.assert(fc.property(reward, event, (given, on) => {
      const result = computeGrant({ reward: given }, on);
      if (result.ok) expect(Math.min(result.value.points, result.value.chips, result.value.spins)).toBeGreaterThanOrEqual(0);
      expect(!result.ok && result.error === 'other_event').toBe(triggerOf(given) !== on.kind);
    }));
  });

  it('never lets a grant past what is left of the budget', () => {
    fc.assert(fc.property(fc.record({ reward, limits }), ledger, grant, event, (promo, past, next, on) => {
      const left = remainingBudget(promo, past, clubDay(on.at));
      const result = checkLimits(promo, next, tallyFor(promo, past, on));
      if (result.ok && left !== null) expect(result.value.chips).toBeLessThanOrEqual(left);
    }));
  });

  it('gives at most one points multiplier for an event, the one giving the most', () => {
    fc.assert(fc.property(fc.array(grant, { maxLength: 6 }), (grants) => {
      const candidates = grants.map((given, index) => ({ promotionId: `p${index}`, grant: given }));
      const chosen = candidates.filter((candidate) => stackGrants(candidates).includes(candidate.promotionId));
      const multipliers = chosen.filter((candidate) => candidate.grant.points > 0);
      expect(multipliers.length).toBeLessThanOrEqual(1);
      const most = Math.max(0, ...grants.map((given) => given.points));
      expect(multipliers[0]?.grant.points ?? 0).toBe(most);
    }));
  });

  it('totals a simulation as the sum of its grants, within the budget and the most grants', () => {
    fc.assert(fc.property(reward, limits, fc.array(event, { maxLength: 25 }), (given, limit, week) => {
      const terms = buildPromotionTerms({ reward: given, limits: limit });
      const result = simulate(terms, week.map((on) => ({ event: on, member: buildMemberFacts() })));
      const sum = (pick: (entry: LedgerEntry) => number) => result.grants.reduce((total, entry) => total + pick(entry), 0);
      expect([result.points, result.chips, result.spins, result.timesGiven]).toEqual([sum((e) => e.points), sum((e) => e.chips), sum((e) => e.spins), result.grants.length]);
      expect(result.chips).toBeLessThanOrEqual(limit.budgetChips ?? Number.MAX_SAFE_INTEGER);
      expect(result.timesGiven).toBeLessThanOrEqual(limit.maxGrants ?? Number.MAX_SAFE_INTEGER);
      expect(result.membersQualified).toBeLessThanOrEqual(new Set(week.map((on) => on.memberId)).size);
    }));
  });

  it('never gives a member more grants in a period than the promotion allows (decision 0499)', () => {
    fc.assert(fc.property(reward, limits, fc.array(event, { maxLength: 25 }), (given, limit, week) => {
      fc.pre(limit.perMember !== 'none');
      const result = simulate(buildPromotionTerms({ reward: given, limits: limit }), week.map((on) => ({ event: on, member: buildMemberFacts() })));
      const perPeriod = new Map<string, number>();
      for (const entry of result.grants) {
        const period = `${entry.memberId} ${entry.periodKey.split('#')[0] ?? ''}`;
        perPeriod.set(period, (perPeriod.get(period) ?? 0) + 1);
      }
      expect(Math.max(0, ...perPeriod.values())).toBeLessThanOrEqual(limit.timesPerMember ?? 1);
    }));
  });

  it('keeps a monthly budget within each month, starting again at the next (decision 0499)', () => {
    const MONTH_END_MS = Date.parse('2026-11-28T06:00:00+05:30');
    const turnOfMonth = fc.tuple(event, fc.integer({ min: 0, max: 6 * 1_440 })).map(([on, minute]) => ({ ...on, at: new Date(MONTH_END_MS + minute * 60_000) }));
    fc.assert(fc.property(reward, chips, fc.array(turnOfMonth, { maxLength: 30 }), (given, budget, days) => {
      const monthly: Limits = { perMember: 'none', budgetChips: budget, budgetPeriod: 'month' };
      const result = simulate(buildPromotionTerms({ reward: given, limits: monthly }), days.map((on) => ({ event: on, member: buildMemberFacts() })));
      const spent = new Map<string, number>();
      for (const entry of result.grants) spent.set(entry.clubDay.slice(0, 7), (spent.get(entry.clubDay.slice(0, 7)) ?? 0) + entry.chips);
      for (const total of spent.values()) expect(total).toBeLessThanOrEqual(budget);
    }));
  });
});
