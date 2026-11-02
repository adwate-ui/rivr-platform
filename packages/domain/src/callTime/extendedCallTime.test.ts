import { describe, expect, it } from 'vitest';
import { extendedCallTimeMinutes } from './index.ts';

describe('Add 1 h from the seat (decision 0300)', () => {
  it('adds an hour to the call time while it still runs', () => {
    expect(extendedCallTimeMinutes(180, 100 * 60)).toBe(240);
  });

  it('past the call time, adds an hour to the minutes played, so the member commits to an hour from now', () => {
    expect(extendedCallTimeMinutes(180, 200 * 60 + 59)).toBe(260);
  });

  it('with no call time, an hour from now; never less than an hour on a clock gone wrong', () => {
    expect(extendedCallTimeMinutes(0, 45 * 60)).toBe(105);
    expect(extendedCallTimeMinutes(0, -30)).toBe(60);
  });
});
