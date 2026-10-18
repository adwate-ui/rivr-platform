import { describe, expect, it } from 'vitest';
import { CHIP, isChipMultiple, roundDownToChip } from './chips.ts';
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
});
