import { describe, expect, it } from 'vitest';
import { add, compare, isNegative, isPositive, isZero, max, min, negate, subtract, sum, times } from './arithmetic.ts';
import { fromRupees } from './paise.ts';

const rupees = fromRupees;

describe('arithmetic', () => {
  it('adds and subtracts', () => {
    expect(add(rupees(2_400n), rupees(100n))).toBe(rupees(2_500n));
    expect(subtract(rupees(1_20_000n), rupees(50_000n))).toBe(rupees(70_000n));
  });

  it('goes below zero when more is taken than there is', () => {
    expect(subtract(rupees(100n), rupees(2_500n))).toBe(rupees(-2_400n));
  });

  it('negates, for the other side of a ledger line', () => {
    expect(negate(rupees(10_000n))).toBe(rupees(-10_000n));
    expect(negate(rupees(-10_000n))).toBe(rupees(10_000n));
  });

  it('sums a list, and an empty list to zero', () => {
    expect(sum([rupees(2_400n), rupees(100n), rupees(6_000n)])).toBe(rupees(8_500n));
    expect(sum([])).toBe(0n);
  });

  it('multiplies by a whole count', () => {
    expect(times(rupees(9_000n), 58n)).toBe(rupees(5_22_000n));
    expect(times(rupees(9_000n), 0n)).toBe(0n);
  });
});

describe('comparisons', () => {
  it('orders amounts for sorting', () => {
    expect(compare(rupees(100n), rupees(200n))).toBe(-1);
    expect(compare(rupees(200n), rupees(100n))).toBe(1);
    expect(compare(rupees(200n), rupees(200n))).toBe(0);
    expect([rupees(300n), rupees(-5n), rupees(100n)].sort(compare)).toEqual([-500n, 10_000n, 30_000n]);
  });

  it('picks the smaller or larger of two amounts', () => {
    expect(min(rupees(7_000n), rupees(6_000n))).toBe(rupees(6_000n));
    expect(min(rupees(2_400n), rupees(6_000n))).toBe(rupees(2_400n));
    expect(max(rupees(7_000n), rupees(6_000n))).toBe(rupees(7_000n));
    expect(max(rupees(2_400n), rupees(6_000n))).toBe(rupees(6_000n));
  });

  it('tells zero, negative and positive apart', () => {
    expect([isZero(rupees(0n)), isZero(rupees(1n)), isZero(rupees(-1n))]).toEqual([true, false, false]);
    expect([isNegative(rupees(-1n)), isNegative(rupees(0n)), isNegative(rupees(1n))]).toEqual([true, false, false]);
    expect([isPositive(rupees(1n)), isPositive(rupees(0n)), isPositive(rupees(-1n))]).toEqual([true, false, false]);
  });
});
