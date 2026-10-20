import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { add, fromPaise, negate } from '../money/index.ts';
import { shiftClose, type ShiftFigures } from './eod.ts';

/** Paise up to ₹10 crore, as a drawer, a cage, a bank statement or the markers hold. */
const paise = fc.bigInt({ min: 0n, max: 10_000_000_000n }).map(fromPaise);
const figures = fc.record({ cash: paise, chips: paise, receipts: paise, markers: paise });
const KEYS = ['cash', 'chips', 'receipts', 'markers'] as const;

describe('shiftClose properties', () => {
  it('is each figure counted less expected, so variance and expected always add back to what was counted', () => {
    fc.assert(fc.property(figures, figures, (counted, expected) => {
      const { variance } = shiftClose(counted, expected);
      for (const key of KEYS) expect(add(variance[key], expected[key])).toBe(counted[key]);
    }));
  });

  it('is an anomaly exactly when a figure differs, whichever way', () => {
    fc.assert(fc.property(figures, figures, (counted, expected) => {
      const differs = KEYS.some((key) => counted[key] !== expected[key]);
      expect(shiftClose(counted, expected).isAnomaly).toBe(differs);
      expect(shiftClose(expected, counted).isAnomaly).toBe(differs);
    }));
  });

  it('closes clean when everything is as expected, and one paisa out anywhere is an anomaly', () => {
    fc.assert(fc.property(figures, fc.constantFrom(...KEYS), (expected: ShiftFigures, key) => {
      expect(shiftClose(expected, expected).isAnomaly).toBe(false);
      const out = { ...expected, [key]: add(expected[key], fromPaise(1n)) };
      expect(shiftClose(out, expected).variance[key]).toBe(fromPaise(1n));
      expect(shiftClose(expected, out).variance[key]).toBe(negate(fromPaise(1n)));
      expect(shiftClose(out, expected).isAnomaly).toBe(true);
    }));
  });
});
