import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { add, subtract, sum, times } from './arithmetic.ts';
import { CHIP, isChipMultiple, roundDownToChip } from './chips.ts';
import { fromPaise } from './paise.ts';
import { parseRupees } from './parse-rupees.ts';
import { shareOf } from './share.ts';

// Up to ₹10,00,00,00,00,00,000 (10^16 paise) either way: past 2^53, where floats lose paise.
const LIMIT = 10n ** 16n;
const anyAmount = fc.bigInt({ min: -LIMIT, max: LIMIT }).map(fromPaise);
const nonNegativeAmount = fc.bigInt({ min: 0n, max: LIMIT }).map(fromPaise);
const basisPoints = fc.bigInt({ min: 0n, max: 10_000n });

/** Plain rupees text for a non-negative amount, such as "2449.50", built without the code under test. */
function asRupeesText(paise: bigint): string {
  return `${paise / 100n}.${(paise % 100n).toString().padStart(2, '0')}`;
}

describe('money properties', () => {
  it('sums to the same total in any order', () => {
    const listAndShuffle = fc
      .array(anyAmount, { maxLength: 30 })
      .chain((amounts) =>
        fc.tuple(fc.constant(amounts), fc.shuffledSubarray(amounts, { minLength: amounts.length })),
      );
    fc.assert(
      fc.property(listAndShuffle, ([amounts, shuffled]) => {
        expect(sum(shuffled)).toBe(sum(amounts));
        expect(sum([...amounts].reverse())).toBe(sum(amounts));
      }),
    );
  });

  it('undoes an addition with a subtraction', () => {
    fc.assert(
      fc.property(anyAmount, anyAmount, (a, b) => {
        expect(subtract(add(a, b), b)).toBe(a);
      }),
    );
  });

  it('rounds down to a chip multiple that never exceeds the input and is within one chip of it', () => {
    fc.assert(
      fc.property(nonNegativeAmount, (amount) => {
        const rounded = roundDownToChip(amount);
        expect(rounded <= amount).toBe(true);
        expect(amount - rounded < CHIP).toBe(true);
        expect(isChipMultiple(rounded)).toBe(true);
      }),
    );
  });

  it('leaves chip multiples where they are', () => {
    const chipMultiple = fc.bigInt({ min: 0n, max: LIMIT / CHIP }).map((count) => times(CHIP, count));
    fc.assert(
      fc.property(chipMultiple, (amount) => {
        expect(roundDownToChip(amount)).toBe(amount);
      }),
    );
  });

  it('takes a share between nothing and the whole amount, growing with the rate', () => {
    fc.assert(
      fc.property(nonNegativeAmount, basisPoints, basisPoints, (amount, low, high) => {
        const [smaller, larger] = low <= high ? [low, high] : [high, low];
        expect(shareOf(amount, smaller) >= 0n).toBe(true);
        expect(shareOf(amount, larger) <= amount).toBe(true);
        expect(shareOf(amount, smaller) <= shareOf(amount, larger)).toBe(true);
      }),
    );
  });

  it('reads back any non-negative amount written as plain rupees', () => {
    fc.assert(
      fc.property(nonNegativeAmount, (amount) => {
        expect(parseRupees(asRupeesText(amount))).toEqual({ ok: true, value: amount });
      }),
    );
  });
});
