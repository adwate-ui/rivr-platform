import { describe, expect, it } from 'vitest';
import { dealerPinEntrySchema, dealerPinSchema, dealerTabletAddSchema, devicePairSchema, deviceRevokeSchema } from './devices.ts';

describe('dealer tablet schemas (#41)', () => {
  it('pairs with six digits only', () => {
    expect(devicePairSchema.safeParse({ code: '048213' }).success).toBe(true);
    expect(devicePairSchema.safeParse({ code: '48213' }).success).toBe(false);
    expect(devicePairSchema.safeParse({ code: '04821a' }).success).toBe(false);
  });

  it('sets a PIN of four digits, not one digit four times', () => {
    expect(dealerPinSchema.safeParse({ pin: '2741' }).success).toBe(true);
    expect(dealerPinSchema.safeParse({ pin: '1111' }).success).toBe(false);
    expect(dealerPinSchema.safeParse({ pin: '274' }).success).toBe(false);
    expect(dealerPinSchema.safeParse({ pin: '27a1' }).success).toBe(false);
  });

  it('takes any four digits on the tablet, where the database checks them', () => {
    expect(dealerPinEntrySchema.safeParse({ pin: '1111' }).success).toBe(true);
    expect(dealerPinEntrySchema.safeParse({ pin: '27410' }).success).toBe(false);
  });

  it('names a tablet and says why one is revoked, trimmed and not blank', () => {
    expect(dealerTabletAddSchema.parse({ name: '  Table 3 tablet ' })).toEqual({ name: 'Table 3 tablet' });
    expect(dealerTabletAddSchema.safeParse({ name: '   ' }).success).toBe(false);
    expect(deviceRevokeSchema.safeParse({ reason: '' }).success).toBe(false);
  });
});
