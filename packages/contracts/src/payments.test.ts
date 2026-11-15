import { describe, expect, it } from 'vitest';
import { bankAccountNumberSchema, ifscSchema, upiVpaSchema } from './payments.ts';

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

describe('ifscSchema and bankAccountNumberSchema', () => {
  it('reads an IFSC in capitals and an account number of 9 to 18 digits', () => {
    expect(ifscSchema.parse(' hdfc0001234 ')).toBe('HDFC0001234');
    expect(bankAccountNumberSchema.parse('50100123456789')).toBe('50100123456789');
  });

  it.each([
    ['an IFSC without its zero', 'HDFC1001234'],
    ['a short IFSC', 'HDFC000123'],
    ['digits where the bank goes', '12340001234'],
  ])('rejects %s', (_reason, input) => {
    expect(ifscSchema.safeParse(input).success).toBe(false);
  });

  it.each([['eight digits', '12345678'], ['nineteen digits', '1234567890123456789'], ['letters', '5010012345678A']])('rejects %s', (_reason, input) => {
    expect(bankAccountNumberSchema.safeParse(input).success).toBe(false);
  });
});
