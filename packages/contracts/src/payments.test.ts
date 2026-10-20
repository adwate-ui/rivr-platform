import { describe, expect, it } from 'vitest';
import { bankAccountNumberSchema, ifscSchema, payoutAccountSchema, upiVpaSchema, utrSchema } from './payments.ts';

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

describe('payoutAccountSchema', () => {
  const blank = { bankName: 'HDFC Bank', vpa: '', accountNumber: '', ifsc: '', holderName: '' };

  it('takes a UPI address without bank details, and bank details without a UPI address', () => {
    expect(payoutAccountSchema.safeParse({ ...blank, kind: 'upi', vpa: 'arjun.mehta@hdfcbank' }).success).toBe(true);
    expect(payoutAccountSchema.safeParse({ ...blank, kind: 'bank', accountNumber: '50100123456789', ifsc: 'HDFC0001234', holderName: 'Arjun Mehta' })
      .success).toBe(true);
  });

  it('writes the account as banks do, and drops the other kind\'s fields', () => {
    expect(payoutAccountSchema.parse({ ...blank, kind: 'bank', accountNumber: ' 50100123456789 ', ifsc: 'hdfc0001234', holderName: ' Arjun Mehta ', vpa: 'x@y' }))
      .toEqual({ kind: 'bank', bankName: 'HDFC Bank', vpa: '', accountNumber: '50100123456789', ifsc: 'HDFC0001234', holderName: 'Arjun Mehta' });
    expect(payoutAccountSchema.parse({ ...blank, kind: 'upi', vpa: ' Arjun@YBL ', ifsc: 'junk' }).vpa).toBe('arjun@ybl');
  });

  it('says which field of the kind chosen is wrong, and needs the bank\'s name', () => {
    const upi = payoutAccountSchema.safeParse({ ...blank, kind: 'upi', vpa: 'arjun' });
    expect(upi.error?.issues.map((issue) => issue.path.join('.'))).toEqual(['vpa']);
    const bank = payoutAccountSchema.safeParse({ ...blank, kind: 'bank', accountNumber: '123', ifsc: 'HDFC0001234', holderName: '' });
    expect(bank.error?.issues.map((issue) => issue.path.join('.'))).toEqual(['accountNumber', 'holderName']);
    expect(payoutAccountSchema.safeParse({ ...blank, kind: 'upi', vpa: 'arjun@ybl', bankName: ' ' }).success).toBe(false);
  });
});