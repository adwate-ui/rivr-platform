import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { fromPaise } from '../money/index.ts';
import { rakebackBonus, weekRakeShares, type RakeHand } from './rakeback.ts';

const CHIP = 5_000n;
const members = ['a', 'b', 'c', 'd', 'e'];

const hand: fc.Arbitrary<RakeHand> = fc.record({
  stake: fc.constantFrom('nlh_50_100', 'nlh_100_200'),
  rake: fc.bigInt({ min: 0n, max: 2_000_000n }).map(fromPaise),
  seated: fc.subarray(members, { minLength: 1 }),
});

describe('rakeback', () => {
  it('never gives the members at a stake more than its hands raked', () => {
    fc.assert(fc.property(fc.array(hand, { maxLength: 30 }), (hands) => {
      const shares = weekRakeShares(hands);
      for (const stake of ['nlh_50_100', 'nlh_100_200']) {
        const raked = hands.filter((one) => one.stake === stake).reduce((total, one) => total + one.rake, 0n);
        const given = [...shares.values()].reduce((total, stakes) => total + (stakes.get(stake) ?? 0n), 0n);
        expect(given <= raked).toBe(true);
      }
    }));
  });

  it('gives a member no more of a hand than the hand raked, whoever else sat', () => {
    fc.assert(fc.property(hand, (one) => {
      for (const member of one.seated) expect((weekRakeShares([one]).get(member)?.get(one.stake) ?? 0n) <= one.rake).toBe(true);
    }));
  });

  it('is whole chips, never more than the rate of the rake, and never less for a higher rate', () => {
    fc.assert(fc.property(fc.bigInt({ min: 0n, max: 100_000_000n }), fc.integer({ min: 1, max: 9_999 }), (paise, rate) => {
      const share = fromPaise(paise);
      const bonus = rakebackBonus(share, rate);
      expect(bonus % CHIP).toBe(0n);
      expect(bonus * 10_000n <= paise * BigInt(rate)).toBe(true);
      expect(rakebackBonus(share, rate + 1) >= bonus).toBe(true);
    }));
  });

  it('is held to the cap', () => {
    fc.assert(fc.property(fc.bigInt({ min: 0n, max: 100_000_000n }), fc.integer({ min: 1, max: 10_000 }), fc.integer({ min: 1, max: 200 }),
      (paise, rate, chips) => {
        expect(rakebackBonus(fromPaise(paise), rate, chips * 5_000) <= BigInt(chips) * CHIP).toBe(true);
      }));
  });
});
