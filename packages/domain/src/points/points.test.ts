import { describe, expect, it } from 'vitest';
import { fromPaise, ZERO } from '../money/index.ts';
import { pointsForTime, rakePoints, rakeShare, tablePlayedSeconds } from './points.ts';

// Each refusal is checked by its own words: dividing a bigint by nothing throws a RangeError too, so any RangeError
// would pass with the guard gone.
describe('points rules a caller can get wrong', () => {
  it('names the input that is negative', () => {
    expect(() => pointsForTime(-1n, 10n)).toThrow('Time played is never negative');
    expect(() => pointsForTime(10n, -1n)).toThrow('A rate of points is never negative');
    expect(() => tablePlayedSeconds(-1n, 10n, 5n)).toThrow('Time at a table is never negative');
    expect(() => rakeShare(fromPaise(-1n), 1n)).toThrow('Rake is never negative');
    expect(() => rakePoints(fromPaise(-1n), 500n)).toThrow('A rake share is never negative');
  });

  it('says why a table or the time played does not fit the session', () => {
    expect(() => tablePlayedSeconds(11n, 10n, 5n)).toThrow('A table holds no more than the whole session');
    expect(() => tablePlayedSeconds(5n, 10n, 11n)).toThrow('Time played is within the session');
    expect(() => tablePlayedSeconds(5n, 10n, -1n)).toThrow('Time played is within the session');
  });

  it('shares rake among at least one seated member', () => {
    expect(() => rakeShare(ZERO, 0n)).toThrow('A share goes to at least one seated member');
  });

  it('takes a rate of 0 to 10,000 basis points, nothing included', () => {
    expect(rakePoints(fromPaise(1_000_000n), 0n)).toBe(0n);
    expect(() => rakePoints(ZERO, -1n)).toThrow('A rate is 0 to 10,000 basis points');
    expect(() => rakePoints(ZERO, 10_001n)).toThrow('A rate is 0 to 10,000 basis points');
  });
});
