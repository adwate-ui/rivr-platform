import { describe, expect, it } from 'vitest';
import { CHIP, chipsToPaise, isChipMultiple, paiseToChips, roundDownToChip } from './chips.ts';
import { fromPaise, fromRupees } from './paise.ts';

describe('chips', () => {
  it('has ₹50 as the smallest chip', () => {
    expect(CHIP).toBe(5_000n);
  });

  it('rounds down to the nearest ₹50', () => {
    expect(roundDownToChip(fromPaise(244_950n))).toBe(fromRupees(2_400n));
    expect(roundDownToChip(fromRupees(2_450n))).toBe(fromRupees(2_450n));
    expect(roundDownToChip(fromPaise(4_999n))).toBe(0n);
  });

  it('throws on a negative amount, which is a bug in the caller', () => {
    expect(() => roundDownToChip(fromPaise(-1n))).toThrow(/round a negative amount/);
  });

  it('says whether an amount can be paid in ₹50 chips, on either side of zero', () => {
    expect(isChipMultiple(fromRupees(5_000n))).toBe(true);
    expect(isChipMultiple(fromRupees(5_025n))).toBe(false);
    expect(isChipMultiple(fromRupees(-50n))).toBe(true);
    expect(isChipMultiple(fromPaise(-1n))).toBe(false);
  });

  it('counts money in chips of ₹1, dropping part of a chip and never rounding up', () => {
    expect(paiseToChips(fromRupees(5_000n))).toBe(5_000n);
    expect(paiseToChips(fromPaise(244_950n))).toBe(2_449n);
    expect(paiseToChips(fromPaise(99n))).toBe(0n);
    expect(paiseToChips(fromPaise(100n))).toBe(1n);
    expect(paiseToChips(fromPaise(0n))).toBe(0n);
  });

  it('turns a count of chips into money, exactly past where floats lose paise', () => {
    expect(chipsToPaise(5_000n)).toBe(fromRupees(5_000n));
    expect(chipsToPaise(0n)).toBe(0n);
    expect(chipsToPaise(9_007_199_254_740_993n)).toBe(900_719_925_474_099_300n);
  });

  it('throws on a negative amount or count, which is a bug in the caller', () => {
    expect(() => paiseToChips(fromPaise(-1n))).toThrow(/negative amount as chips/);
    expect(() => chipsToPaise(-1n)).toThrow(/negative count of chips/);
  });
});
