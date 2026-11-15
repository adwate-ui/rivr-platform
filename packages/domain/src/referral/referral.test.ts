import { describe, expect, it } from 'vitest';
import { fromPaise, fromRupees, ZERO } from '../money/index.ts';
import { referralPromise } from './index.ts';

describe('what Refer a friend promises (redesign RD-20)', () => {
  it('promises the live referral promotion\'s Bonus, each', () => {
    expect(referralPromise(fromRupees(1_000n))).toEqual({ kind: 'reward', bonus: fromRupees(1_000n) });
    expect(referralPromise(fromPaise(1n))).toEqual({ kind: 'reward', bonus: fromPaise(1n) });
  });

  it('offers the invite alone while no referral promotion is live', () => {
    expect(referralPromise(null)).toEqual({ kind: 'invite' });
  });

  it('promises nothing for a live promotion that gives nothing', () => {
    expect(referralPromise(ZERO)).toEqual({ kind: 'invite' });
    expect(referralPromise(fromPaise(-100n))).toEqual({ kind: 'invite' });
  });
});
