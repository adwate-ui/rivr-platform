import { describe, expect, it } from 'vitest';
import { gstinSchema, indianMobileSchema, panSchema } from './identity.ts';

describe('indianMobileSchema', () => {
  it.each([
    ['+919876543210', '+919876543210'],
    ['9876543210', '+919876543210'],
    ['+91 98765 43210', '+919876543210'],
    ['98765-43210', '+919876543210'],
    [' 6000000000 ', '+916000000000'],
  ])('reads %s as %s', (input, mobile) => {
    expect(indianMobileSchema.parse(input)).toBe(mobile);
  });

  it.each([
    ['a number starting with 5', '5876543210'],
    ['nine digits', '987654321'],
    ['eleven digits', '98765432101'],
    ['another country code', '+929876543210'],
    ['a trunk zero', '09876543210'],
    ['letters', '98765abcde'],
    ['nothing', ''],
  ])('rejects %s', (_reason, input) => {
    expect(indianMobileSchema.safeParse(input).success).toBe(false);
  });
});

describe('panSchema', () => {
  it('reads a PAN in capitals, whatever case it was typed in', () => {
    expect(panSchema.parse('abcpe1234f')).toBe('ABCPE1234F');
    expect(panSchema.parse(' ABCPE1234F ')).toBe('ABCPE1234F');
  });

  it.each([
    ['a holder type that does not exist (fourth letter X)', 'ABCXE1234F'],
    ['digits where letters belong', 'ABC1E1234F'],
    ['too short', 'ABCPE1234'],
    ['too long', 'ABCPE1234FF'],
  ])('rejects %s', (_reason, input) => {
    expect(panSchema.safeParse(input).success).toBe(false);
  });
});

describe('gstinSchema', () => {
  it('reads a GSTIN whose check character is right', () => {
    expect(gstinSchema.parse('27AAPFU0939F1ZV')).toBe('27AAPFU0939F1ZV');
    expect(gstinSchema.parse('27aapfu0939f1zv')).toBe('27AAPFU0939F1ZV');
  });

  it.each([
    ['a wrong check character', '27AAPFU0939F1ZW'],
    ['a mistyped PAN inside it', '27AAPFV0939F1ZV'],
    ['no Z in the fourteenth place', '27AAPFU0939F1YV'],
    ['a letter in the state code', '2XAAPFU0939F1ZV'],
    ['too short', '27AAPFU0939F1Z'],
  ])('rejects %s', (_reason, input) => {
    expect(gstinSchema.safeParse(input).success).toBe(false);
  });
});
