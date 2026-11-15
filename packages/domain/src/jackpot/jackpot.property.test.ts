import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { fromPaise, shareOf } from '../money/index.ts';
import { splitDrop } from './jackpot.ts';

// Drops of ₹0 to ₹500 in paise, and shares up to 50% each as the setting allows.
const drop = fc.bigInt({ min: 0n, max: 50_000n }).map(fromPaise);
const shares = fc.record({ season: fc.bigInt({ min: 0n, max: 5_000n }), freeroll: fc.bigInt({ min: 0n, max: 5_000n }) });

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
});
