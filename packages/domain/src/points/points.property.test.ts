import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { fromPaise, ZERO } from '../money/index.ts';
import { pointsForTime, rakePoints, rakeShare, tablePlayedSeconds } from './points.ts';

/** Up to a day at the table, in seconds; up to 1,000 points an hour. */
const seconds = fc.bigInt({ min: 0n, max: 86_400n });
const perHour = fc.bigInt({ min: 0n, max: 1_000n });
/** Rake from nothing to ₹1 lakh, in paise, and up to ten members seated. */
const rake = fc.bigInt({ min: 0n, max: 10_000_000n }).map(fromPaise);
const seated = fc.bigInt({ min: 1n, max: 10n });
const rate = fc.bigInt({ min: 0n, max: 10_000n });

describe('pointsForTime properties', () => {
  it('never gives more than the exact points for the time, and less by under one point', () => {
    fc.assert(fc.property(seconds, perHour, (played, rateAnHour) => {
      const points = pointsForTime(played, rateAnHour);
      // points ≤ played × rate / 3600 < points + 1, in whole numbers.
      expect(points * 3_600n <= played * rateAnHour).toBe(true);
      expect(played * rateAnHour < (points + 1n) * 3_600n).toBe(true);
    }));
  });

  it('gives more, never less, for more time at the same rate', () => {
    fc.assert(fc.property(seconds, seconds, perHour, (a, b, rateAnHour) => {
      const [shorter, longer] = a <= b ? [a, b] : [b, a];
      expect(pointsForTime(shorter, rateAnHour) <= pointsForTime(longer, rateAnHour)).toBe(true);
    }));
  });

  it('refuses negative time or a negative rate', () => {
    expect(() => pointsForTime(-1n, 10n)).toThrow(RangeError);
    expect(() => pointsForTime(10n, -1n)).toThrow(RangeError);
  });
});

describe('tablePlayedSeconds properties', () => {
  /** A session split between two tables, and the time played in it. */
  const session = fc.tuple(seconds, seconds).chain(([first, second]) =>
    fc.bigInt({ min: 0n, max: first + second }).map((played) => ({ first, second, played })),
  );

  it('shares the time played between two tables without giving out more than was played, and loses under two seconds', () => {
    fc.assert(fc.property(session, ({ first, second, played }) => {
      const total = first + second;
      const shared = tablePlayedSeconds(first, total, played) + tablePlayedSeconds(second, total, played);
      expect(shared <= played).toBe(true);
      expect(played - shared < 2n).toBe(true);
    }));
  });

  it('gives a table no more than its own time, and a session with no move all of the time played', () => {
    fc.assert(fc.property(session, ({ first, second, played }) => {
      expect(tablePlayedSeconds(first, first + second, played) <= first).toBe(true);
      expect(tablePlayedSeconds(first + second, first + second, played)).toBe(played);
    }));
  });

  it('refuses a table longer than its session, or time played outside it', () => {
    expect(() => tablePlayedSeconds(-1n, 10n, 5n)).toThrow(RangeError);
    expect(() => tablePlayedSeconds(11n, 10n, 5n)).toThrow(RangeError);
    expect(() => tablePlayedSeconds(5n, 10n, 11n)).toThrow(RangeError);
    expect(() => tablePlayedSeconds(5n, 10n, -1n)).toThrow(RangeError);
    expect(tablePlayedSeconds(0n, 0n, 0n)).toBe(0n);
  });
});

describe('rakeShare properties', () => {
  it('never shares out more than the rake, and leaves less than a paisa for each seated member', () => {
    fc.assert(fc.property(rake, seated, (handRake, members) => {
      const share = rakeShare(handRake, members);
      expect(share * members <= handRake).toBe(true);
      expect(handRake - share * members < members).toBe(true);
    }));
  });

  it('refuses negative rake or nobody seated', () => {
    expect(() => rakeShare(fromPaise(-1n), 1n)).toThrow(RangeError);
    expect(() => rakeShare(ZERO, 0n)).toThrow(RangeError);
  });
});

describe('rakePoints properties', () => {
  it('gives a whole point for each rupee of the share at the rate, rounded down', () => {
    fc.assert(fc.property(rake, rate, (share, basisPoints) => {
      const points = rakePoints(share, basisPoints);
      // points ≤ share × rate / 1,000,000 < points + 1, in whole numbers.
      expect(points * 1_000_000n <= share * basisPoints).toBe(true);
      expect(share * basisPoints < (points + 1n) * 1_000_000n).toBe(true);
    }));
  });

  it('refuses a negative share, or a rate outside 0% to 100%', () => {
    expect(() => rakePoints(fromPaise(-1n), 500n)).toThrow(RangeError);
    expect(() => rakePoints(ZERO, -1n)).toThrow(RangeError);
    expect(() => rakePoints(ZERO, 10_001n)).toThrow(RangeError);
    expect(rakePoints(fromPaise(100n), 10_000n)).toBe(1n);
  });
});
