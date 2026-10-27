import { PROMOTION_BUILDER_LIMITS, PROMOTION_BUILDER_REWARDS, type PromotionBuilder } from '@rivr/contracts/promotions';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { CHIP, fromPaise, sum } from '../money/index.ts';
import { promotionDraft } from './builder.ts';
import { simulatePromotion, type PromotionSimulation, type ReplayEvent, type SimulationBudget } from './simulate.ts';

// One club day: Tuesday 17 November, 06:00 to 06:00 IST.
const DAY_START = new Date('2026-11-17T06:00:00+05:30').getTime();
const WEEK_MS = 7 * 86_400_000;

const choices: fc.Arbitrary<PromotionBuilder> = fc.record({
  days: fc.constant([]),
  from: fc.constant(null),
  until: fc.constant(null),
  stake: fc.constantFrom(null, 'nlh_100_200'),
  reward: fc.constantFrom(...PROMOTION_BUILDER_REWARDS),
  limit: fc.constantFrom(...PROMOTION_BUILDER_LIMITS),
  bonus_cap_rupees: fc.integer({ min: 1, max: 200 }).map((chips) => chips * 50),
});
const event = (spanMs: number): fc.Arbitrary<ReplayEvent> => fc.record({
  at: fc.integer({ min: 0, max: spanMs - 1 }).map((offset) => new Date(DAY_START + offset)),
  memberId: fc.constantFrom('arjun', 'kabir', 'naina', 'rohan', 'tara'),
  tierId: fc.constant(null),
  tableId: fc.constantFrom('t1', 't3'),
  stake: fc.constantFrom('nlh_25_50', 'nlh_100_200'),
  amount: fc.bigInt({ min: 0n, max: 400n }).map((chips) => fromPaise(chips * CHIP)),
  points: fc.bigInt({ min: 0n, max: 600n }),
  hoursPlayed: fc.integer({ min: 0, max: 24 }),
});
const budget: fc.Arbitrary<SimulationBudget> = fc.record({
  cap: fc.option(fc.bigInt({ min: 0n, max: 100n }).map((chips) => fromPaise(chips * CHIP)), { nil: null }),
  count: fc.option(fc.integer({ min: 0, max: 30 }), { nil: null }),
});

function replay(builder: PromotionBuilder, events: readonly ReplayEvent[], limits?: SimulationBudget): PromotionSimulation {
  const result = simulatePromotion(promotionDraft(builder), events, limits);
  if (!result.ok) throw new Error('A builder promotion is always replayable');
  return result.value;
}

describe('promotion simulation properties', () => {
  it('never gives more than the budget, in rupees or grants, and counts what is left', () => {
    fc.assert(fc.property(choices, fc.array(event(WEEK_MS), { maxLength: 60 }), budget, (builder, events, limits) => {
      const simulation = replay(builder, events, limits);
      if (limits.cap !== null) {
        expect(simulation.cost <= limits.cap).toBe(true);
        expect(simulation.budgetLeft).toBe(limits.cap - simulation.cost);
      } else {
        expect(simulation.budgetLeft).toBeNull();
      }
      if (limits.count !== null) expect(simulation.grants <= limits.count).toBe(true);
      expect(simulation.members <= simulation.grants).toBe(true);
      expect(simulation.events).toBe(events.length);
    }));
  });

  it('costs whole ₹50 chips for a bonus, and nothing in rupees for points', () => {
    fc.assert(fc.property(choices, fc.array(event(WEEK_MS), { maxLength: 40 }), (builder, events) => {
      const simulation = replay(builder, events);
      expect(simulation.cost % CHIP).toBe(0n);
      if (builder.reward === 'buy_in_bonus') expect(simulation.points).toBe(0n);
      else expect(simulation.cost).toBe(0n);
      expect(simulation.cost <= sum(events.map((one) => one.amount))).toBe(true);
    }));
  });

  it('gives each member once over the promotion, and the first 50 of a club day once each', () => {
    fc.assert(fc.property(choices, fc.array(event(86_400_000), { maxLength: 80 }), (builder, events) => {
      const simulation = replay({ ...builder, limit: 'once_per_member' }, events);
      expect(simulation.grants).toBe(simulation.members);
      const firstFifty = replay({ ...builder, limit: 'first_50' }, events);
      expect(firstFifty.grants).toBe(firstFifty.members);
      expect(firstFifty.grants <= 50).toBe(true);
    }));
  });

  it('weighs events in time order, whatever order they come in', () => {
    const distinct = fc.uniqueArray(event(WEEK_MS), { selector: (one) => one.at.getTime(), maxLength: 40 });
    fc.assert(fc.property(choices, distinct, (builder, events) => {
      expect(replay(builder, [...events].reverse())).toEqual(replay(builder, events));
    }));
  });
});
