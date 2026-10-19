import { describe, expect, it } from 'vitest';
import { fromPaise } from '../money/index.ts';
import { badBeatPayout, splitDrop } from './jackpot.ts';

const RULE = { poolShare: 10_000n, loser: 5_000n, winner: 2_500n, table: 2_500n };

describe('jackpot rules a caller can get wrong', () => {
  it('refuses shares of the drop below nought or above 100% together', () => {
    expect(() => splitDrop(fromPaise(10_000n), { season: -1n, freeroll: 0n })).toThrow(RangeError);
    expect(() => splitDrop(fromPaise(10_000n), { season: 0n, freeroll: -1n })).toThrow(RangeError);
    expect(() => splitDrop(fromPaise(10_000n), { season: 5_000n, freeroll: 5_001n })).toThrow(RangeError);
    expect(splitDrop(fromPaise(10_000n), { season: 5_000n, freeroll: 5_000n })).toEqual({ main: 0n, season: 5_000n, freeroll: 5_000n });
  });

  it('refuses a payout split that is not 100%, a share outside 0% to 100%, and a count of others that is not one', () => {
    expect(() => badBeatPayout(fromPaise(100_000n), { ...RULE, table: 2_499n }, 3)).toThrow(RangeError);
    expect(() => badBeatPayout(fromPaise(100_000n), { ...RULE, table: 2_501n }, 3)).toThrow(RangeError);
    // Adds up to 100%, but a negative table share with nobody else dealt in would pay more than the pool.
    expect(() => badBeatPayout(fromPaise(34_270_000n), { poolShare: 7_602n, loser: 5_000n, winner: 8_469n, table: -3_469n }, 0)).toThrow(RangeError);
    expect(() => badBeatPayout(fromPaise(100_000n), { ...RULE, poolShare: 10_001n }, 3)).toThrow(RangeError);
    expect(() => badBeatPayout(fromPaise(100_000n), RULE, -1)).toThrow(RangeError);
    expect(() => badBeatPayout(fromPaise(100_000n), RULE, 1.5)).toThrow(RangeError);
  });

  it('pays the table nothing while the pool is too small for a chip each', () => {
    expect(badBeatPayout(fromPaise(10_000n), RULE, 9)).toEqual({ loser: 5_000n, winner: 0n, eachAtTable: 0n, total: 5_000n });
  });
});
