import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { fromPaise } from '../money/index.ts';
import { cashLimitHit } from './aml.ts';

const paise = fc.bigInt({ min: 0n, max: 100_000_000n }).map(fromPaise);
const limit = fc.option(paise, { nil: null });

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
