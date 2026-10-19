import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { CHIP, fromPaise, isChipMultiple, shareOf, type Paise } from '../money/index.ts';
import { badBeatPayout, splitDrop, type PayoutRule } from './jackpot.ts';

// Drops of ₹0 to ₹500 in paise, pools up to ₹1 crore, shares up to 50% each as the setting allows,
// payout rules that split 100%, and up to nine others dealt in.
const drop = fc.bigInt({ min: 0n, max: 50_000n }).map(fromPaise);
const pool = fc.bigInt({ min: 0n, max: 1_000_000_000n }).map(fromPaise);
const shares = fc.record({ season: fc.bigInt({ min: 0n, max: 5_000n }), freeroll: fc.bigInt({ min: 0n, max: 5_000n }) });
const rule: fc.Arbitrary<PayoutRule> = fc
  .record({ poolShare: fc.bigInt({ min: 0n, max: 10_000n }), loser: fc.bigInt({ min: 0n, max: 10_000n }), winner: fc.bigInt({ min: 0n, max: 10_000n }) })
  .filter((r) => r.loser + r.winner <= 10_000n)
  .map((r) => ({ ...r, table: 10_000n - r.loser - r.winner }));
const others = fc.integer({ min: 0, max: 9 });

describe('jackpot properties', () => {
  it('splits a drop into parts that add up to it, with season and freeroll never above their share', () => {
    fc.assert(
      fc.property(drop, shares, (amount, share) => {
        const split = splitDrop(amount, share);
        expect(split.main + split.season + split.freeroll).toBe(amount);
        expect(split.season).toBe(shareOf(amount, share.season));
        expect(split.freeroll).toBe(shareOf(amount, share.freeroll));
        expect(split.main >= 0n).toBe(true);
      }),
    );
  });

  it('pays whole chips, never more than the rule\'s share of the pool, and leaves no whole chip of any part behind', () => {
    fc.assert(
      fc.property(pool, rule, others, (amount, payout, count) => {
        const paid = shareOf(amount, payout.poolShare);
        const result = badBeatPayout(amount, payout, count);
        expect([result.loser, result.winner, result.eachAtTable].every(isChipMultiple)).toBe(true);
        expect(result.total <= paid).toBe(true);
        expect(result.loser + CHIP > shareOf(paid, payout.loser)).toBe(true);
        expect(result.winner + CHIP > shareOf(paid, payout.winner)).toBe(true);
        if (count > 0) expect((result.eachAtTable + CHIP) * BigInt(count) > shareOf(paid, payout.table)).toBe(true);
      }),
    );
  });

  it('keeps the main pool equal to every drop\'s main part less every payout, and never below nought', () => {
    const event = fc.oneof(
      fc.record({ kind: fc.constant('drop' as const), amount: drop, share: shares }),
      fc.record({ kind: fc.constant('payout' as const), payout: rule, count: others }),
    );
    fc.assert(
      fc.property(pool, fc.array(event, { maxLength: 40 }), (seed, events) => {
        let balance: Paise = seed;
        let dropped = 0n;
        let paidOut = 0n;
        for (const next of events) {
          if (next.kind === 'drop') {
            const { main } = splitDrop(next.amount, next.share);
            balance = fromPaise(balance + main);
            dropped += main;
          } else {
            const { total } = badBeatPayout(balance, next.payout, next.count);
            balance = fromPaise(balance - total);
            paidOut += total;
          }
          expect(balance >= 0n).toBe(true);
        }
        expect(balance).toBe(seed + dropped - paidOut);
      }),
    );
  });
});
