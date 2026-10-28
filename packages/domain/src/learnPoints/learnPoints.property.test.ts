import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { learnPoints } from './learnPoints.ts';

const count = fc.bigInt({ min: 0n, max: 50n });
const points = fc.bigInt({ min: 0n, max: 5_000n });
const rates = fc.record({ perSession: points, perPrinciple: points, dailyCap: points });

describe('learnPoints', () => {
  it('never takes the day past its cap, and never gives below nothing', () => {
    fc.assert(fc.property(count, points, rates, (mastered, today, rate) => {
      const earned = learnPoints(mastered, today, rate);
      expect(earned >= 0n).toBe(true);
      expect(earned === 0n || today + earned <= rate.dailyCap).toBe(true);
    }));
  });

  it('never gives more than the session and its principles are worth, and all of it while the cap allows', () => {
    fc.assert(fc.property(count, points, rates, (mastered, today, rate) => {
      const worth = rate.perSession + mastered * rate.perPrinciple;
      const earned = learnPoints(mastered, today, rate);
      expect(earned <= worth).toBe(true);
      if (today + worth <= rate.dailyCap) expect(earned).toBe(worth);
    }));
  });
});
