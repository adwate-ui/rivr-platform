import { describe, expect, it } from 'vitest';
import { handEntrySchema } from './hands.ts';

describe('a hand as the dealer enters it (#42)', () => {
  it('takes a pot of whole ₹50 chips, in rupees as the keypad types it', () => {
    expect(handEntrySchema.safeParse({ pot: '48000', variant: 'holdem' }).success).toBe(true);
    expect(handEntrySchema.safeParse({ pot: '50', variant: 'plo' }).success).toBe(true);
    expect(handEntrySchema.safeParse({ pot: '140010', variant: 'holdem' }).success).toBe(false);
  });

  it('takes no empty pot, no leading nought, and nothing above ₹1 crore', () => {
    expect(handEntrySchema.safeParse({ pot: '', variant: 'holdem' }).success).toBe(false);
    expect(handEntrySchema.safeParse({ pot: '0', variant: 'holdem' }).success).toBe(false);
    expect(handEntrySchema.safeParse({ pot: '0500', variant: 'holdem' }).success).toBe(false);
    expect(handEntrySchema.safeParse({ pot: '10000000', variant: 'holdem' }).success).toBe(true);
    expect(handEntrySchema.safeParse({ pot: '10000050', variant: 'holdem' }).success).toBe(false);
  });

  it('takes Hold\'em, PLO and bomb pots only', () => {
    expect(handEntrySchema.safeParse({ pot: '48000', variant: 'bomb_pot' }).success).toBe(true);
    expect(handEntrySchema.safeParse({ pot: '48000', variant: 'omaha' }).success).toBe(false);
  });
});
