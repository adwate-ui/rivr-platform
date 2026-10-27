import { describe, expect, it } from 'vitest';
import { formatMoney, formatNights, formatNumber, formatRupeesForFile, formatRupeesForInput, formatStakes } from './money.ts';

describe('formatMoney', () => {
  it.each([
    [0n, '₹0'],
    [500_000n, '₹5,000'],
    [12_000_000n, '₹1,20,000'],
    [18_500_000n, '₹1,85,000'],
    [34_260_000n, '₹3,42,600'],
    [1_000_000_000n, '₹1,00,00,000'],
  ])('writes %s paise as %s with Indian grouping and no decimals', (paise, text) => {
    expect(formatMoney(paise)).toBe(text);
  });

  it('shows paise only when there are some, and never rounds them away', () => {
    expect(formatMoney(12_000_050n)).toBe('₹1,20,000.50');
    expect(formatMoney(7n)).toBe('₹0.07');
  });

  it('puts a minus sign before the rupee symbol for negatives', () => {
    expect(formatMoney(-100_000n)).toBe('−₹1,000');
  });
});

describe('formatStakes', () => {
  it('writes blinds in rupees as small/big', () => {
    expect(formatStakes(10_000n, 20_000n)).toBe('100/200');
    expect(formatStakes(5_000n, 10_000n)).toBe('50/100');
    expect(formatStakes(100_000n, 200_000n)).toBe('1,000/2,000');
  });
});

describe('formatNights', () => {
  it('gives nights from thousandths, with no trailing zeros and Indian grouping', () => {
    expect(formatNights(0n)).toBe('0');
    expect(formatNights(2_000n)).toBe('2');
    expect(formatNights(1_250n)).toBe('1.25');
    expect(formatNights(175n)).toBe('0.175');
    expect(formatNights(1_200_500n)).toBe('1,200.5');
    expect(formatNights(-1_250n)).toBe('-1.25');
  });
});

describe('formatNumber', () => {
  it('groups points the Indian way', () => {
    expect(formatNumber(18_420)).toBe('18,420');
    expect(formatNumber(1_234_567n)).toBe('12,34,567');
  });
});

describe('formatRupeesForFile', () => {
  it('gives plain rupees with two decimals for a file, never rounding', () => {
    expect(formatRupeesForFile(2_000_000n)).toBe('20000.00');
    expect(formatRupeesForFile(5n)).toBe('0.05');
    expect(formatRupeesForFile(100_050n)).toBe('1000.50');
    expect(formatRupeesForFile(-100_050n)).toBe('-1000.50');
    expect(formatRupeesForFile(0n)).toBe('0.00');
  });
});

describe('formatRupeesForInput', () => {
  it('gives whole rupees as a field holds them', () => {
    expect(formatRupeesForInput(1_000_000n)).toBe('10000');
    expect(formatRupeesForInput(0n)).toBe('0');
  });
});
