import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { fromPaise } from '../money/index.ts';
import { AGEING_BUCKETS, ageingBucket, creditAgeing } from './ageing.ts';

const DAY_MS = 86_400_000;
const moment = fc.integer({ min: 1_700_000_000_000, max: 1_900_000_000_000 });
const later = fc.integer({ min: 0, max: 400 * DAY_MS });

describe('credit ageing properties', () => {
  it('never moves a marker to a younger bucket as time goes on', () => {
    fc.assert(fc.property(moment, later, later, (issued, first, more) => {
      const earlier = ageingBucket(new Date(issued), new Date(issued + first));
      const after = ageingBucket(new Date(issued), new Date(issued + first + more));
      expect(AGEING_BUCKETS.indexOf(after) >= AGEING_BUCKETS.indexOf(earlier)).toBe(true);
    }));
  });

  it('puts every rupee owed in exactly one bucket', () => {
    const marker = fc.record({ age: later, owed: fc.bigInt({ min: 1n, max: 100_000n }) });
    fc.assert(fc.property(moment, fc.array(marker, { maxLength: 6 }), (at, markers) => {
      const totals = creditAgeing(markers.map(({ age, owed }) => ({ issuedAt: new Date(at - age), outstanding: fromPaise(owed * 5_000n) })), new Date(at));
      const owed = markers.reduce((total, { owed: chips }) => total + chips * 5_000n, 0n);
      expect(AGEING_BUCKETS.reduce((total, bucket) => total + totals[bucket], 0n)).toBe(owed);
    }));
  });
});
