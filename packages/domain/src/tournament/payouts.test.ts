import { describe, expect, it } from 'vitest';
import { fromPaise, fromRupees } from '../money/index.ts';
import { chipChop, dealAmounts, icmDeal } from './deals.ts';
import { areSharesWhole, bountyOnBust, payoutTable, prizePool } from './payouts.ts';

const rupees = (...amounts: bigint[]) => amounts.map(fromRupees);

describe('prizePool', () => {
  it('refuses a pool or a guarantee below nothing', () => {
    expect(() => prizePool(fromPaise(-5000n), null)).toThrow('A pool and a guarantee are nothing or more');
    expect(() => prizePool(fromPaise(0n), fromPaise(-5000n))).toThrow(RangeError);
  });

  it('adds no overlay when the buys pass the guarantee', () => {
    expect(prizePool(fromRupees(600n), fromRupees(500n))).toEqual({ pool: fromRupees(600n), overlay: fromRupees(0n) });
  });
});

describe('areSharesWhole and payoutTable', () => {
  it('takes one to a hundred whole shares above nothing adding up to 100%', () => {
    expect(areSharesWhole([10_000])).toBe(true);
    expect(areSharesWhole(Array.from({ length: 100 }, () => 100))).toBe(true);
    expect(areSharesWhole([])).toBe(false);
    expect(areSharesWhole([...Array.from({ length: 100 }, () => 99), 100])).toBe(false);
    expect(areSharesWhole([5000.5, 4999.5])).toBe(false);
    expect(areSharesWhole([10_001, -1])).toBe(false);
    expect(areSharesWhole([3000, 7000])).toBe(false);
    expect(areSharesWhole([5000, 5000])).toBe(true);
  });

  it('refuses shares that are not whole, a run that is not a whole number, and a pool below nothing or not in chips', () => {
    expect(() => payoutTable(fromRupees(100n), [5000, 4000], 2)).toThrow('Shares adding up to 100%, and a run');
    expect(() => payoutTable(fromRupees(100n), [10_000], 1.5)).toThrow(RangeError);
    expect(() => payoutTable(fromPaise(-5000n), [10_000], 1)).toThrow('A pool in ₹50 chips');
    expect(() => payoutTable(fromPaise(2500n), [10_000], 1)).toThrow(RangeError);
  });
});

describe('deals', () => {
  it('refuses more than nine players, a prize for each missing, no chips, and prizes below nothing or not in chips', () => {
    const ten = Array.from({ length: 10 }, () => 1n);
    expect(() => chipChop(ten, ten.map(() => fromRupees(50n)))).toThrow('Two to nine players, one prize each');
    expect(() => icmDeal([1n], [fromRupees(50n)])).toThrow(RangeError);
    expect(() => chipChop([10n, 0n], rupees(100n, 50n))).toThrow('Stacks above nothing and prizes in ₹50 chips');
    expect(() => icmDeal([10n, -1n], rupees(100n, 50n))).toThrow(RangeError);
    expect(() => chipChop([10n, 10n], [fromRupees(100n), fromPaise(-5000n)])).toThrow(RangeError);
    expect(() => icmDeal([10n, 10n], [fromRupees(100n), fromPaise(2500n)])).toThrow(RangeError);
  });

  it('is sure of the smallest prize wherever it stands in the list', () => {
    expect(chipChop([3n, 1n], rupees(50n, 150n))).toEqual(rupees(150n, 50n));
  });

  it('works the deal by its method', () => {
    const stacks = [900_000n, 600_000n, 450_000n];
    const prizes = rupees(160_100n, 106_600n, 79_950n);
    expect(dealAmounts('icm', stacks, prizes)).toEqual(icmDeal(stacks, prizes));
    expect(dealAmounts('chip_chop', stacks, prizes)).toEqual(chipChop(stacks, prizes));
    expect(dealAmounts('icm', stacks, prizes)).not.toEqual(dealAmounts('chip_chop', stacks, prizes));
  });
});

describe('bountyOnBust', () => {
  it('refuses a bounty below nothing', () => {
    expect(() => bountyOnBust(fromPaise(-5000n), 'standard')).toThrow('A bounty in ₹50 chips');
  });
});
