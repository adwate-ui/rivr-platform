import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { hourShares, WHOLE_POOL } from './tipPool.ts';

describe('hourShares', () => {
  it('shares the pool by the time each dealer dealt, in basis points adding up to the whole', () => {
    expect(hourShares([3600, 1800, 1800])).toEqual([5000, 2500, 2500]);
  });

  it('gives the basis points left after rounding down to the largest remainders, the earlier dealer first on a tie', () => {
    expect(hourShares([1, 1, 1])).toEqual([3334, 3333, 3333]);
    expect(hourShares([2, 1, 1, 2])).toEqual([3333, 1667, 1667, 3333]);
  });

  it('shares nothing when no one dealt', () => {
    expect(hourShares([])).toEqual([]);
    expect(hourShares([0, 0])).toEqual([0, 0]);
  });

  it('refuses time below nothing or not whole seconds', () => {
    expect(() => hourShares([-1, 10])).toThrow('Whole seconds, nothing or more');
    expect(() => hourShares([1.5])).toThrow(RangeError);
  });

  it('always adds up to the whole pool, and more time never earns less', () => {
    fc.assert(fc.property(fc.array(fc.integer({ min: 0, max: 200_000 }), { minLength: 1, maxLength: 40 }), (seconds) => {
      const shares = hourShares(seconds);
      const total = shares.reduce((sum, share) => sum + share, 0);
      expect(total).toBe(seconds.some((each) => each > 0) ? WHOLE_POOL : 0);
      seconds.forEach((one, i) => seconds.forEach((other, j) => {
        if (one > other) expect(shares[i] ?? 0).toBeGreaterThanOrEqual(shares[j] ?? 0);
      }));
    }));
  });
});
