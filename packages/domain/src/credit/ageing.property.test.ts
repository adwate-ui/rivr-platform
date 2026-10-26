import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { AGEING_BUCKETS, ageingBucket } from './ageing.ts';

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

  it('puts a marker issued after the moment asked about in the first bucket', () => {
    fc.assert(fc.property(moment, later, (at, ahead) => {
      expect(ageingBucket(new Date(at + ahead), new Date(at))).toBe('0_7');
    }));
  });
});
