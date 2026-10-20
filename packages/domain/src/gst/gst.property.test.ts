import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { add, fromPaise, ZERO } from '../money/index.ts';
import { gstIncluded, igstIncluded } from './gst.ts';

/** Paise from nothing to ₹1 crore: an amount collected. */
const inclusive = fc.bigInt({ min: 0n, max: 1_000_000_000n }).map(fromPaise);
const rate = fc.bigInt({ min: 0n, max: 10_000n });

describe('gstIncluded properties', () => {
  it('splits the amount whole: taxable, CGST and SGST add up to it, with equal halves and nothing below zero', () => {
    fc.assert(fc.property(inclusive, rate, (amount, bp) => {
      const split = gstIncluded(amount, bp);
      expect(add(add(split.taxable, split.cgst), split.sgst)).toBe(amount);
      expect(split.cgst).toBe(split.sgst);
      expect(split.cgst >= 0n && split.taxable >= 0n).toBe(true);
    }));
  });

  it('takes each half within half a paisa of the exact half of the tax', () => {
    fc.assert(fc.property(inclusive, rate, (amount, bp) => {
      const { cgst } = gstIncluded(amount, bp);
      // |cgst − amount × bp / (2 × (10,000 + bp))| ≤ ½, in whole numbers: |2 × cgst × d − 2 × amount × bp| ≤ d, d = 2 × (10,000 + bp).
      const divisor = 2n * (10_000n + bp);
      const gap = 2n * cgst * divisor - 2n * amount * bp;
      expect(gap <= divisor && -gap <= divisor).toBe(true);
    }));
  });

  it('takes no tax at a rate of nothing, and refuses a negative amount or a rate past 100%', () => {
    fc.assert(fc.property(inclusive, (amount) => {
      expect(gstIncluded(amount, 0n)).toEqual({ taxable: amount, cgst: ZERO, sgst: ZERO });
    }));
    expect(() => gstIncluded(fromPaise(-1n), 1800n)).toThrow(RangeError);
    expect(() => gstIncluded(ZERO, -1n)).toThrow(RangeError);
    expect(() => gstIncluded(ZERO, 10_001n)).toThrow(RangeError);
    expect(gstIncluded(fromPaise(100n), 10_000n)).toEqual({ taxable: fromPaise(50n), cgst: fromPaise(25n), sgst: fromPaise(25n) });
  });
});

describe('igstIncluded properties', () => {
  it('splits the amount whole: taxable and IGST add up to it, with nothing below zero', () => {
    fc.assert(fc.property(inclusive, rate, (amount, bp) => {
      const split = igstIncluded(amount, bp);
      expect(add(split.taxable, split.igst)).toBe(amount);
      expect(split.igst >= 0n && split.taxable >= 0n).toBe(true);
    }));
  });

  it('takes the tax within half a paisa of the exact tax, and within a paisa of CGST and SGST together', () => {
    fc.assert(fc.property(inclusive, rate, (amount, bp) => {
      const { igst } = igstIncluded(amount, bp);
      // |igst − amount × bp / d| ≤ ½, in whole numbers: |2 × igst × d − 2 × amount × bp| ≤ d, d = 10,000 + bp.
      const divisor = 10_000n + bp;
      const gap = 2n * igst * divisor - 2n * amount * bp;
      expect(gap <= divisor && -gap <= divisor).toBe(true);
      const { cgst, sgst } = gstIncluded(amount, bp);
      const apart = add(cgst, sgst) - igst;
      expect(apart >= -1n && apart <= 1n).toBe(true);
    }));
  });

  it('rounds a half paisa up, takes no tax at a rate of nothing, and refuses a negative amount or a rate past 100%', () => {
    // 16 paise at 28% is 3.5 paise of tax.
    expect(igstIncluded(fromPaise(16n), 2_800n)).toEqual({ taxable: fromPaise(12n), igst: fromPaise(4n) });
    fc.assert(fc.property(inclusive, (amount) => {
      expect(igstIncluded(amount, 0n)).toEqual({ taxable: amount, igst: ZERO });
    }));
    expect(() => igstIncluded(fromPaise(-1n), 1800n)).toThrow(RangeError);
    expect(() => igstIncluded(ZERO, -1n)).toThrow(RangeError);
    expect(() => igstIncluded(ZERO, 10_001n)).toThrow(RangeError);
    expect(igstIncluded(fromPaise(100n), 10_000n)).toEqual({ taxable: fromPaise(50n), igst: fromPaise(50n) });
  });
});
