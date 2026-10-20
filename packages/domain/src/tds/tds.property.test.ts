import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { add, compare, fromPaise, ZERO } from '../money/index.ts';
import { tdsOnCashOut, type TdsRule } from './tds.ts';

/** Paise from -₹1 crore to ₹1 crore: a period's net winnings. */
const winnings = fc.bigInt({ min: -1_000_000_000n, max: 1_000_000_000n }).map(fromPaise);
const paise = fc.bigInt({ min: 0n, max: 1_000_000_000n }).map(fromPaise);
const rate = fc.bigInt({ min: 0n, max: 10_000n });
const rule: fc.Arbitrary<TdsRule> = fc.record({ rate, threshold: paise, panRequired: fc.boolean(), noPanRate: rate });

describe('tdsOnCashOut properties', () => {
  it('never withholds below nothing, nor more than the cash-out pays, nor more than the period still owes', () => {
    const cashOut = fc.record({ winnings, already: paise, payout: paise, hasPan: fc.boolean() });
    fc.assert(fc.property(cashOut, rule, (input, tdsRule) => {
      const tds = tdsOnCashOut(input, tdsRule);
      expect(compare(tds.amount, ZERO)).toBeGreaterThanOrEqual(0);
      expect(compare(tds.amount, input.payout)).toBeLessThanOrEqual(0);
      expect(compare(add(tds.amount, input.already), tds.due) <= 0 || tds.amount === ZERO).toBe(true);
    }));
  });

  it('owes whole rupees, never more than the rate of the winnings, and nothing at or below the threshold', () => {
    fc.assert(fc.property(winnings, paise, fc.boolean(), rule, (won, payout, hasPan, tdsRule) => {
      const tds = tdsOnCashOut({ winnings: won, already: ZERO, payout, hasPan }, tdsRule);
      expect(tds.due % 100n).toBe(0n);
      if (compare(won, tdsRule.threshold) <= 0) expect(tds.due).toBe(ZERO);
      else expect(tds.due * 10_000n <= won * tds.rate).toBe(true);
    }));
  });

  it('withholds across a period what the period owes, however its cash-outs fall, until a cash-out pays too little', () => {
    fc.assert(fc.property(paise, paise, rule, (first, second, tdsRule) => {
      const big = fromPaise(10_000_000_000n);
      const one = tdsOnCashOut({ winnings: first, already: ZERO, payout: big, hasPan: true }, tdsRule);
      const two = tdsOnCashOut({ winnings: add(first, second), already: one.amount, payout: big, hasPan: true }, tdsRule);
      const once = tdsOnCashOut({ winnings: add(first, second), already: ZERO, payout: big, hasPan: true }, tdsRule);
      expect(compare(add(one.amount, two.amount), once.amount)).toBeGreaterThanOrEqual(0);
      if (compare(one.amount, once.amount) <= 0) expect(add(one.amount, two.amount)).toBe(once.amount);
    }));
  });
});
