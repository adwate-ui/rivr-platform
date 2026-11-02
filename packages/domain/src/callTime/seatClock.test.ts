import { describe, expect, it } from 'vitest';
import { CALL_TIME_ENDING_SECONDS, callTimeFraction, isCallTimeEnding, minutesLeftToSay, secondsUntil } from './index.ts';

describe('the seat\'s call-time clock on Tonight (decision 0320)', () => {
  it('is ending in its last 15 minutes while it still runs', () => {
    expect(CALL_TIME_ENDING_SECONDS).toBe(900);
    expect([901, 900, 899, 1, 0, -5].map(isCallTimeEnding)).toEqual([false, true, true, true, false, false]);
  });

  it('says the minutes left rounded up, and none below nought', () => {
    expect([890, 841, 840, 60, 59, 1, 0, -30].map(minutesLeftToSay)).toEqual([15, 15, 14, 1, 1, 1, 0, 0]);
  });

  it('draws the ring as the share of the call time left, between empty and full', () => {
    expect(callTimeFraction(5400, 180)).toBe(0.5);
    expect(callTimeFraction(10_800, 180)).toBe(1);
    expect(callTimeFraction(12_000, 180)).toBe(1);
    expect(callTimeFraction(0, 180)).toBe(0);
    expect(callTimeFraction(-10, 180)).toBe(0);
    expect(callTimeFraction(600, 0)).toBe(0);
    expect(callTimeFraction(600, -1)).toBe(0);
  });

  it('counts down in whole seconds to a time the server gave, never below nought', () => {
    const at = new Date('2026-11-15T17:00:00.000Z');
    expect(secondsUntil(new Date('2026-11-15T17:00:10.000Z'), at)).toBe(10);
    expect(secondsUntil(new Date('2026-11-15T17:00:09.200Z'), at)).toBe(10);
    expect(secondsUntil(new Date('2026-11-15T17:00:00.000Z'), at)).toBe(0);
    expect(secondsUntil(new Date('2026-11-15T16:59:00.000Z'), at)).toBe(0);
  });
});
