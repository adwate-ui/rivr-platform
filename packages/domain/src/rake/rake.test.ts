import { describe, expect, it } from 'vitest';
import { fromPaise, fromRupees } from '../money/index.ts';
import { potTake, type RakeRules } from './rake.ts';

// A ₹6,000-cap table at 5%, with the ₹100 drop above ₹5,000 while the jackpot is live.
const TABLE: RakeRules = {
  rateBasisPoints: 500n,
  cap: fromRupees(6_000n),
  isJackpotLive: true,
  drop: fromRupees(100n),
  dropAbove: fromRupees(5_000n),
};

describe('potTake', () => {
  it('refuses a negative pot, which is a bug in the caller', () => {
    expect(() => potTake(fromPaise(-1n), TABLE)).toThrow(RangeError);
  });

  it('drops whole chips even when the drop is set off a chip', () => {
    expect(potTake(fromRupees(10_000n), { ...TABLE, drop: fromRupees(120n) }).drop).toBe(fromRupees(100n));
  });

  it('rakes whole chips even when the cap is set off a chip', () => {
    expect(potTake(fromRupees(1_40_000n), { ...TABLE, cap: fromRupees(5_980n) }).rake).toBe(fromRupees(5_950n));
  });
});
