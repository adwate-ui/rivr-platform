import { describe, expect, it } from 'vitest';
import { isTopUpLate, secondsWaiting, TOP_UP_TARGET_SECONDS } from './index.ts';

describe('a top-up\'s wait (decision 0299)', () => {
  const asked = new Date('2026-11-15T16:00:00Z');

  it('counts whole seconds since it was asked for, never below nothing', () => {
    expect(secondsWaiting(asked, new Date('2026-11-15T16:00:42.900Z'))).toBe(42);
    expect(secondsWaiting(asked, new Date('2026-11-15T15:59:58Z'))).toBe(0);
  });

  it('is late only past sixty seconds', () => {
    expect(TOP_UP_TARGET_SECONDS).toBe(60);
    expect([59, 60, 61].map(isTopUpLate)).toEqual([false, false, true]);
  });
});
