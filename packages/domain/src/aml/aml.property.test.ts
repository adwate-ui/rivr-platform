import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { fromPaise } from '../money/index.ts';
import { cashLimitHit, isNearLimit } from './aml.ts';

const paise = fc.bigInt({ min: 0n, max: 100_000_000n }).map(fromPaise);
const limit = fc.option(paise, { nil: null });
const margin = fc.integer({ min: 0, max: 10_000 });

describe('cashLimitHit properties', () => {
  it('lets through exactly the buy-ins that keep both totals within their limits', () => {
    const limits = fc.record({ perVisit: limit, perDay: limit });
    fc.assert(fc.property(limits, paise, paise, paise, ({ perVisit, perDay }, visitSoFar, daySoFar, amount) => {
      const hit = cashLimitHit({ perVisit, perDay }, visitSoFar, daySoFar, amount);
      const pastVisit = perVisit !== null && perVisit > 0n && visitSoFar + amount > perVisit;
      const pastDay = perDay !== null && perDay > 0n && daySoFar + amount > perDay;
      expect(hit).toBe(pastVisit ? 'visit' : pastDay ? 'day' : null);
    }));
  });

  it('never refuses with no limits set', () => {
    fc.assert(fc.property(paise, paise, paise, (visitSoFar, daySoFar, amount) => {
      expect(cashLimitHit({ perVisit: null, perDay: fromPaise(0n) }, visitSoFar, daySoFar, amount)).toBeNull();
    }));
  });
});

describe('isNearLimit properties', () => {
  it('holds only for a total from the limit less its margin up to the limit itself', () => {
    fc.assert(fc.property(paise, paise, margin, (total, cap, basisPoints) => {
      if (isNearLimit(total, cap, basisPoints)) {
        expect(total > 0n && total <= cap && total >= cap - (cap * BigInt(basisPoints)) / 10_000n).toBe(true);
      }
    }));
  });

  it('a wider margin never makes a total less near, and the limit itself is always near', () => {
    fc.assert(fc.property(paise, paise.filter((cap) => cap > 0n), margin, margin, (total, cap, a, b) => {
      const [narrow, wide] = a <= b ? [a, b] : [b, a];
      if (isNearLimit(total, cap, narrow)) expect(isNearLimit(total, cap, wide)).toBe(true);
      expect(isNearLimit(cap, cap, narrow)).toBe(true);
    }));
  });
});
