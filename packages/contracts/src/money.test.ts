import { describe, expect, it } from 'vitest';
import { paiseSchema } from './money.ts';

describe('paiseSchema', () => {
  it.each([
    [500_000n, 500_000n],
    ['500000', 500_000n],
    ['-250000', -250_000n],
    ['0', 0n],
    ['10000000000000101', 10_000_000_000_000_101n],
  ])('reads %s as %s paise', (input, paise) => {
    expect(paiseSchema.parse(input)).toBe(paise);
  });

  it.each([
    ['a JavaScript number, which can lose paise above 2^53', 500_000],
    ['a float', 12.5],
    ['a decimal string', '12.50'],
    ['an exponent', '1e5'],
    ['grouped digits', '1,20,000'],
    ['a leading zero', '0500'],
    ['surrounding spaces', ' 500 '],
    ['an empty string', ''],
    ['a rupee amount', '₹500'],
  ])('rejects %s', (_reason, input) => {
    expect(paiseSchema.safeParse(input).success).toBe(false);
  });
});
