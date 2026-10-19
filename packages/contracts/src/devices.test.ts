import { describe, expect, it } from 'vitest';
import {
  dealerPinEntrySchema, dealerPinSchema, dealerTabletAddSchema, devicePairRequestSchema, devicePairSchema, deviceRevokeSchema, tvPairingSchema, tvPairSchema,
} from './devices.ts';

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

describe('TV pairing schemas (#49)', () => {
  const secret = 'a'.repeat(64);

  it('takes a TV asking for a code, or asking again with its secret', () => {
    expect(devicePairRequestSchema.parse({ tv: 'start' })).toEqual({ tv: 'start' });
    expect(devicePairRequestSchema.parse({ tv: 'check', secret })).toEqual({ tv: 'check', secret });
    expect(devicePairRequestSchema.parse({ code: '048213' })).toEqual({ code: '048213' });
  });

  it('refuses a secret that is not 64 hex characters, or an ask without one', () => {
    expect(tvPairingSchema.safeParse({ tv: 'check', secret: 'A'.repeat(64) }).success).toBe(false);
    expect(tvPairingSchema.safeParse({ tv: 'check', secret: secret.slice(1) }).success).toBe(false);
    expect(tvPairingSchema.safeParse({ tv: 'check' }).success).toBe(false);
    expect(devicePairRequestSchema.safeParse({ tv: 'pair' }).success).toBe(false);
  });

  it('pairs a TV with its code, a trimmed name and one of the modes', () => {
    expect(tvPairSchema.parse({ code: '000417', name: ' Bar TV ', mode: 'waitlist' })).toEqual({ code: '000417', name: 'Bar TV', mode: 'waitlist' });
    expect(tvPairSchema.safeParse({ code: '000417', name: 'Bar TV', mode: 'menu' }).success).toBe(false);
    expect(tvPairSchema.safeParse({ code: '000417', name: ' ', mode: 'jackpot' }).success).toBe(false);
  });
});
