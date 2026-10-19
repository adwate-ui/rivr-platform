import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { fromPaise, isChipMultiple } from '../money/index.ts';
import { markerCheck } from './markers.ts';

const chips = fc.bigInt({ min: 0n, max: 2_000_000n }).map((count) => fromPaise(count * 5_000n));
const anyPaise = fc.bigInt({ min: -1n, max: 100_000_000n }).map(fromPaise);

describe('markerCheck properties', () => {
  it('issues only whole chips that keep the member within their limit and the room within its cap, with nothing past due', () => {
    const terms = fc.record({ outstanding: chips, limit: chips, exposure: chips, cap: chips, isPastDue: fc.boolean() });
    fc.assert(fc.property(anyPaise, terms, (amount, given) => {
      if (markerCheck(amount, given).ok) {
        expect(amount > 0n && isChipMultiple(amount) && !given.isPastDue).toBe(true);
        expect(given.outstanding + amount <= given.limit && given.exposure + amount <= given.cap).toBe(true);
      }
    }));
  });

  it('refuses for a marker past due before anything about the amount it is for', () => {
    fc.assert(fc.property(chips, chips, chips, (amount, limit, cap) => {
      fc.pre(amount > 0n);
      const result = markerCheck(amount, { outstanding: fromPaise(0n), limit, exposure: fromPaise(0n), cap, isPastDue: true });
      expect(result).toEqual({ ok: false, error: 'past_due' });
    }));
  });
});
