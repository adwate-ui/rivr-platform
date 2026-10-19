import { describe, expect, it } from 'vitest';
import { highHandClaimSchema, highHandRejectSchema } from './highHands.ts';

describe('high-hand schemas (#47)', () => {
  it('claims a category at a seat from 1 to 10', () => {
    expect(highHandClaimSchema.safeParse({ category: 'straight_flush', seat: 4, rank: null }).success).toBe(true);
    expect(highHandClaimSchema.safeParse({ category: 'straight_flush', seat: 11, rank: null }).success).toBe(false);
    expect(highHandClaimSchema.safeParse({ category: 'full_house', seat: 4, rank: null }).success).toBe(false);
  });

  it('names the rank of a four of a kind, and only of a four of a kind', () => {
    expect(highHandClaimSchema.safeParse({ category: 'four_of_a_kind', seat: 2, rank: 'Q' }).success).toBe(true);
    expect(highHandClaimSchema.safeParse({ category: 'four_of_a_kind', seat: 2, rank: null }).success).toBe(false);
    expect(highHandClaimSchema.safeParse({ category: 'royal_flush', seat: 2, rank: 'A' }).success).toBe(false);
  });

  it('rejects with a reason of at least three characters, trimmed', () => {
    expect(highHandRejectSchema.parse({ reason: '  Misread  ' })).toEqual({ reason: 'Misread' });
    expect(highHandRejectSchema.safeParse({ reason: ' no ' }).success).toBe(false);
  });
});
