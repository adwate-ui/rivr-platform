import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { add, fromPaise, negate } from '../money/index.ts';
import { downVariance } from './variance.ts';

/** Whole ₹50 chips up to ₹1 crore, as counts, rake, drops and thresholds are. */
const chips = fc.bigInt({ min: 0n, max: 200_000n }).map((count) => fromPaise(count * 5_000n));

describe('downVariance properties', () => {
  it('is the count less what was logged, so the two always add back to the count', () => {
    fc.assert(fc.property(chips, chips, fc.option(chips, { nil: null }), (dropBox, logged, threshold) => {
      expect(add(downVariance(dropBox, logged, threshold).variance, logged)).toBe(dropBox);
    }));
  });

  it('alerts the same whichever way the box is out', () => {
    fc.assert(fc.property(chips, chips, fc.option(chips, { nil: null }), (dropBox, logged, threshold) => {
      const over = downVariance(dropBox, logged, threshold);
      const short = downVariance(logged, dropBox, threshold);
      expect(short.variance).toBe(negate(over.variance));
      expect(short.isAlert).toBe(over.isAlert);
    }));
  });

  it('never alerts on a down that balances, and a higher threshold never alerts where a lower one does not', () => {
    fc.assert(fc.property(chips, chips, chips, chips, (dropBox, logged, low, extra) => {
      expect(downVariance(dropBox, dropBox, low).isAlert).toBe(false);
      if (!downVariance(dropBox, logged, low).isAlert) expect(downVariance(dropBox, logged, add(low, extra)).isAlert).toBe(false);
    }));
  });
});
