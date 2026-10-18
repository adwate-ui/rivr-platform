import { describe, expect, it } from 'vitest';
import { parseRupees } from './parse-rupees.ts';

describe('parseRupees', () => {
  it.each([
    ['1,20,000', 12_000_000n],
    ['120000', 12_000_000n],
    ['₹1,20,000', 12_000_000n],
    ['₹ 5,000', 500_000n],
    ['  2,449.50 ', 244_950n],
    ['2449.5', 244_950n],
    ['12.05', 1_205n],
    ['0.5', 50n],
    ['0', 0n],
    ['1,000', 100_000n],
    ['12,34,56,789', 123_456_789_00n],
    ['10,00,00,00,00,00,001.01', 10_000_000_000_000_101n],
  ])('reads "%s" as %s paise', (text, paise) => {
    expect(parseRupees(text)).toEqual({ ok: true, value: paise });
  });

  it.each([
    ['', 'empty'],
    ['   ', 'empty'],
    ['₹', 'empty'],
    ['-500', 'negative'],
    ['−500', 'negative'],
    ['₹-500', 'negative'],
    ['12.345', 'too_many_decimals'],
    ['1,20,000.001', 'too_many_decimals'],
    ['abc', 'invalid'],
    ['12.3.4', 'invalid'],
    ['1,2,3', 'invalid'],
    ['120,000', 'invalid'],
    ['1,20,00', 'invalid'],
    ['.5', 'invalid'],
    ['5.', 'invalid'],
    ['1e5', 'invalid'],
    ['+500', 'invalid'],
    ['5 000', 'invalid'],
    ['5₹00', 'invalid'],
    ['5-00', 'invalid'],
  ])('rejects "%s" as %s', (text, error) => {
    expect(parseRupees(text)).toEqual({ ok: false, error });
  });
});
