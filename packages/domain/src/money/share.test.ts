import { describe, expect, it } from 'vitest';
import { fromPaise, fromRupees } from './paise.ts';
import { shareOf } from './share.ts';

describe('shareOf', () => {
  it('takes a share in basis points: 500 is 5%', () => {
    expect(shareOf(fromRupees(48_000n), 500n)).toBe(fromRupees(2_400n));
  });

  it('rounds down to the paisa, never up', () => {
    expect(shareOf(fromPaise(199n), 500n)).toBe(9n);
    expect(shareOf(fromPaise(19n), 500n)).toBe(0n);
  });

  it('takes nothing at 0 basis points and everything at 10,000', () => {
    expect(shareOf(fromRupees(2_500n), 0n)).toBe(0n);
    expect(shareOf(fromRupees(2_500n), 10_000n)).toBe(fromRupees(2_500n));
  });

  it('throws on a negative amount, which is a bug in the caller', () => {
    expect(() => shareOf(fromPaise(-1n), 500n)).toThrow(/share of a negative amount/);
  });

  it('throws on a rate outside 0% to 100%, which is a bug in the caller', () => {
    expect(() => shareOf(fromRupees(100n), -1n)).toThrow(/between 0 and 10,000 basis points/);
    expect(() => shareOf(fromRupees(100n), 10_001n)).toThrow(/between 0 and 10,000 basis points/);
  });
});
