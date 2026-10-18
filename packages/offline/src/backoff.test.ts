import { describe, expect, it } from 'vitest';
import { DEFAULT_RETRY, retryDelay } from './backoff.ts';

describe('retryDelay', () => {
  it('doubles from the first delay after each failed attempt in a row', () => {
    expect([1, 2, 3, 4].map((failures) => retryDelay(failures, DEFAULT_RETRY))).toEqual([1_000, 2_000, 4_000, 8_000]);
  });

  it('never waits longer than the cap', () => {
    expect(retryDelay(7, DEFAULT_RETRY)).toBe(60_000);
    expect(retryDelay(50, DEFAULT_RETRY)).toBe(60_000);
  });

  it('waits the first delay when nothing has failed yet', () => {
    expect(retryDelay(0, { firstDelayMs: 500, maxDelayMs: 4_000 })).toBe(500);
  });
});
