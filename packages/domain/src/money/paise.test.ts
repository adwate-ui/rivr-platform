import { describe, expect, it } from 'vitest';
import { fromPaise, fromRupees, ZERO } from './paise.ts';

describe('building money', () => {
  it('takes a count of paise as it is', () => {
    expect(fromPaise(250_000n)).toBe(250_000n);
    expect(fromPaise(-7n)).toBe(-7n);
  });

  it('turns whole rupees into paise', () => {
    expect(fromRupees(2_500n)).toBe(250_000n);
    expect(fromRupees(0n)).toBe(0n);
    expect(fromRupees(-1_000n)).toBe(-100_000n);
  });

  it('has a zero', () => {
    expect(ZERO).toBe(0n);
  });
});
