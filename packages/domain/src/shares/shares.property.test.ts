import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { fromPaise, ZERO } from '../money/index.ts';
import { rakeShare, tablePlayedSeconds } from './shares.ts';

/** Up to a day at the table, in seconds. */
const seconds = fc.bigInt({ min: 0n, max: 86_400n });
/** Rake from nothing to ₹1 lakh, in paise, and up to ten members seated. */
const rake = fc.bigInt({ min: 0n, max: 10_000_000n }).map(fromPaise);
const seated = fc.bigInt({ min: 1n, max: 10n });

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
