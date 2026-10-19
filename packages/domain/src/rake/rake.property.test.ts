import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { CHIP, fromPaise, fromRupees, isChipMultiple, min, shareOf } from '../money/index.ts';
import { potTake, type RakeRules } from './rake.ts';

// Pots up to ₹1 crore, in whole chips as on the floor, and realistic rules: 1% to 10%, a cap of
// ₹50 to ₹50,000 in whole chips, a ₹50 to ₹500 drop above ₹1,000 to ₹10,000.
const chips = (most: bigint) => fc.bigInt({ min: 0n, max: most }).map((count) => fromPaise(count * CHIP));
const pot = chips(2_00_000n);
const rules: fc.Arbitrary<RakeRules> = fc.record({
  rateBasisPoints: fc.bigInt({ min: 100n, max: 1_000n }),
  cap: chips(1_000n).filter((cap) => cap > 0n),
  isJackpotLive: fc.boolean(),
  drop: fc.bigInt({ min: 1n, max: 10n }).map((count) => fromPaise(count * CHIP)),
  dropAbove: fc.bigInt({ min: 20n, max: 200n }).map((count) => fromPaise(count * CHIP)),
});

describe('rake properties', () => {
  it('takes whole chips, never more than the rate or the cap, and leaves no whole chip of either behind', () => {
    fc.assert(
      fc.property(pot, rules, (amount, rule) => {
        const { rake, drop } = potTake(amount, rule);
        const ceiling = min(shareOf(amount, rule.rateBasisPoints), rule.cap);
        expect(isChipMultiple(rake) && isChipMultiple(drop)).toBe(true);
        expect(rake <= ceiling).toBe(true);
        expect(rake + CHIP > ceiling).toBe(true);
      }),
    );
  });

  it('says the cap applied exactly when the rate of the pot is more than the cap, and then the rake is the cap in chips', () => {
    fc.assert(
      fc.property(pot, rules, (amount, rule) => {
        const take = potTake(amount, rule);
        expect(take.isCapApplied).toBe(shareOf(amount, rule.rateBasisPoints) > rule.cap);
        if (take.isCapApplied) expect(take.rake).toBe(rule.cap - (rule.cap % CHIP));
      }),
    );
  });

  it('pulls the rake and the drop together, never more than the pot', () => {
    fc.assert(
      fc.property(pot, rules, (amount, rule) => {
        const take = potTake(amount, rule);
        expect(take.pull).toBe(take.rake + take.drop);
        expect(take.pull <= amount).toBe(true);
      }),
    );
  });

  it('drops only while the jackpot is live, and only from a pot above the threshold', () => {
    fc.assert(
      fc.property(pot, rules, (amount, rule) => {
        const expected = rule.isJackpotLive && amount > rule.dropAbove ? rule.drop : 0n;
        expect(potTake(amount, rule).drop).toBe(expected);
      }),
    );
  });

  it('never takes less from a bigger pot', () => {
    fc.assert(
      fc.property(pot, pot, rules, (a, b, rule) => {
        const [small, large] = a <= b ? [a, b] : [b, a];
        expect(potTake(small, rule).pull <= potTake(large, rule).pull).toBe(true);
      }),
    );
  });

  it('takes nothing from an empty pot', () => {
    fc.assert(
      fc.property(rules, (rule) => {
        expect(potTake(fromRupees(0n), rule)).toEqual({ rake: 0n, drop: 0n, pull: 0n, isCapApplied: false });
      }),
    );
  });
});
