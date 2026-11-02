import { describe, expect, it } from 'vitest';
import { CALL_TIME_CHOICES, isCallTimeMinutes } from './index.ts';

describe('the call times the floor gives as it seats a player (decision 0299)', () => {
  it('offers three, four and five hours', () => {
    expect(CALL_TIME_CHOICES).toEqual([180, 240, 300]);
  });

  it('takes any other whole number of minutes from none to a day', () => {
    expect([0, 1, 150, 1440].map(isCallTimeMinutes)).toEqual([true, true, true, true]);
    expect([-1, 1441, 90.5, Number.NaN, null].map(isCallTimeMinutes)).toEqual([false, false, false, false, false]);
  });
});
