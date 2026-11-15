import { describe, expect, it } from 'vitest';
import { fromPaise, ZERO } from '../money/index.ts';
import { rakeShare, tablePlayedSeconds } from './shares.ts';

// Each refusal is checked by its own words: dividing a bigint by nothing throws a RangeError too, so any RangeError
// would pass with the guard gone.
describe('share rules a caller can get wrong', () => {
  it('names the input that is negative', () => {
    expect(() => tablePlayedSeconds(-1n, 10n, 5n)).toThrow('Time at a table is never negative');
    expect(() => rakeShare(fromPaise(-1n), 1n)).toThrow('Rake is never negative');
  });

  it('says why a table or the time played does not fit the session', () => {
    expect(() => tablePlayedSeconds(11n, 10n, 5n)).toThrow('A table holds no more than the whole session');
    expect(() => tablePlayedSeconds(5n, 10n, 11n)).toThrow('Time played is within the session');
    expect(() => tablePlayedSeconds(5n, 10n, -1n)).toThrow('Time played is within the session');
  });

  it('shares rake among at least one seated member', () => {
    expect(() => rakeShare(ZERO, 0n)).toThrow('A share goes to at least one seated member');
  });
});
