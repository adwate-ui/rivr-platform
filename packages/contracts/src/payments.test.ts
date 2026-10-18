import { describe, expect, it } from 'vitest';
import { upiVpaSchema, utrSchema } from './payments.ts';

describe('upiVpaSchema', () => {
  it.each([
    ['arjun.mehta@hdfcbank', 'arjun.mehta@hdfcbank'],
    ['9876543210@ybl', '9876543210@ybl'],
    [' Arjun_Mehta-1@OKHDFCBANK ', 'arjun_mehta-1@okhdfcbank'],
  ])('reads %s as %s', (input, vpa) => {
    expect(upiVpaSchema.parse(input)).toBe(vpa);
  });

  it.each([
    ['no handle', 'arjun.mehta'],
    ['nothing before the @', '@hdfcbank'],
    ['nothing after the @', 'arjun@'],
    ['a space inside', 'arjun mehta@hdfcbank'],
    ['two @ signs', 'arjun@mehta@hdfcbank'],
    ['a dotted handle', 'arjun@hdfc.bank'],
  ])('rejects %s', (_reason, input) => {
    expect(upiVpaSchema.safeParse(input).success).toBe(false);
  });
});

describe('utrSchema', () => {
  it('reads a twelve-digit UTR', () => {
    expect(utrSchema.parse('412908771204')).toBe('412908771204');
    expect(utrSchema.parse(' 412908771204 ')).toBe('412908771204');
  });

  it.each([
    ['eleven digits', '41290877120'],
    ['thirteen digits', '4129087712045'],
    ['letters', '41290877120A'],
    ['a number', 412908771204],
  ])('rejects %s', (_reason, input) => {
    expect(utrSchema.safeParse(input).success).toBe(false);
  });
});
