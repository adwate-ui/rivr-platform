import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { CHIP, compare, fromPaise, shareOf } from '../money/index.ts';
import { promotionApplies, promotionReward, promotionsToGive, type PromotionCandidate, type PromotionFacts } from './promotions.ts';

const paise = (max: bigint) => fc.bigInt({ min: 0n, max }).map((value) => fromPaise(value));
const limit = fc.option(fc.integer({ min: 0, max: 3 }), { nil: null });
const candidate: fc.Arbitrary<PromotionCandidate> = fc.record({
  promotion: fc.uuid(),
  stacks: fc.boolean(),
  cost: paise(500_000n),
  budgetLeft: fc.option(paise(500_000n), { nil: null }),
  grantsLeft: limit,
  playerLeft: limit,
  isGiven: fc.boolean(),
});
const facts: fc.Arbitrary<PromotionFacts> = fc.record({
  at: fc.date({ min: new Date('2026-11-01T00:00:00Z'), max: new Date('2027-11-01T00:00:00Z'), noInvalidDate: true }),
  tierId: fc.option(fc.constantFrom('member', 'black'), { nil: null }),
  stake: fc.option(fc.constantFrom('nlh_25_50', 'nlh_100_200'), { nil: null }),
  tableId: fc.option(fc.constantFrom('table-1', 'table-3'), { nil: null }),
  visitsInMonth: fc.integer({ min: 0, max: 31 }),
  daysSinceLastVisit: fc.option(fc.integer({ min: 0, max: 400 }), { nil: null }),
  isCallTimeComplete: fc.boolean(),
  grantedToday: fc.integer({ min: 0, max: 20 }),
  grantedTodayAtTable: fc.integer({ min: 0, max: 20 }),
  hoursPlayed: fc.integer({ min: 0, max: 48 }).map((halves) => halves / 2),
  hand: fc.option(fc.constantFrom('royal_flush', 'bad_beat'), { nil: null }),
});

describe('promotion properties', () => {
  it('gives only what each budget and limit allows, never twice, and in priority order', () => {
    fc.assert(fc.property(fc.uniqueArray(candidate, { selector: (one) => one.promotion, maxLength: 6 }), (all) => {
      const given = promotionsToGive(all);
      const positions = given.map((promotion) => all.findIndex((one) => one.promotion === promotion));
      expect(positions).toEqual([...new Set(positions)].sort((a, b) => a - b));
      all.filter((one) => given.includes(one.promotion)).forEach((one) => {
        expect(one.isGiven).toBe(false);
        expect((one.grantsLeft ?? 1) > 0 && (one.playerLeft ?? 1) > 0).toBe(true);
        if (one.budgetLeft !== null) expect(compare(one.cost, one.budgetLeft) <= 0).toBe(true);
      });
    }));
  });

  it('gives a promotion that does not stack only alone', () => {
    fc.assert(fc.property(fc.uniqueArray(candidate, { selector: (one) => one.promotion, maxLength: 6 }), (all) => {
      const given = new Set(promotionsToGive(all));
      if (given.size === 0) return;
      const together = all.filter((one) => one.isGiven || given.has(one.promotion));
      if (together.some((one) => !one.stacks)) expect(together).toHaveLength(1);
    }));
  });

  it('gives a bonus share in whole ₹50 chips, within a chip of the share and never above its cap', () => {
    const cap = fc.option(fc.integer({ min: 1, max: 200 }).map((chips) => chips * 5_000), { nil: undefined });
    fc.assert(fc.property(paise(10_000_000n), fc.integer({ min: 1, max: 10_000 }), cap, (buyIn, bps, capPaise) => {
      const effect = capPaise === undefined
        ? { kind: 'bonus' as const, percent_bps: bps, expires_days: 7 }
        : { kind: 'bonus' as const, percent_bps: bps, cap_paise: capPaise, expires_days: 7 };
      const reward = promotionReward(effect, { amount: buyIn, points: 0n });
      const share = shareOf(buyIn, BigInt(bps));
      if (reward === null) {
        expect(share < CHIP).toBe(true);
        return;
      }
      expect(reward.cost % CHIP).toBe(0n);
      expect(reward.cost <= share && (capPaise === undefined || reward.cost <= BigInt(capPaise))).toBe(true);
      if (capPaise === undefined || reward.cost < BigInt(capPaise)) expect(share - reward.cost < CHIP).toBe(true);
    }));
  });

  it('applies a rule with no conditions, or every day, to anyone at any time', () => {
    fc.assert(fc.property(facts, (moment) => {
      expect(promotionApplies({}, moment)).toBe(true);
      expect(promotionApplies({ days: [1, 2, 3, 4, 5, 6, 7], from: '06:00', until: '06:00' }, moment)).toBe(true);
    }));
  });
});
