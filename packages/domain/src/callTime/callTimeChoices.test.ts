import { describe, expect, it } from 'vitest';
import { isCallTimeMinutes } from './index.ts';

describe('the call time the floor types as it seats a player (decision 0299, redesign RD-19)', () => {
  it('is any whole number of minutes from none to a day', () => {
    expect([0, 1, 150, 1440].map(isCallTimeMinutes)).toEqual([true, true, true, true]);
    expect([-1, 1441, 90.5, Number.NaN, null].map(isCallTimeMinutes)).toEqual([false, false, false, false, false]);
  });
});
