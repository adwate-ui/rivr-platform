import { describe, expect, it } from 'vitest';
import { bonusChipsToRedeemSchema } from './waitlist.ts';

describe('bonus chips to redeem as the floor seats a member (decision 0504)', () => {
  it('reads blank and 0 as none, and whole 50s as so many chips', () => {
    expect(['', '  ', '0', '50', '1000', ' 1500 '].map((typed) => bonusChipsToRedeemSchema.parse(typed))).toEqual([0, 0, 0, 50, 1000, 1500]);
  });

  it('refuses part of a chip, a figure that is not whole 50s, a sign or a figure too long', () => {
    for (const typed of ['25', '1020', '-50', '50.5', '1,000', 'abc', '123456789']) expect(bonusChipsToRedeemSchema.safeParse(typed).success).toBe(false);
  });
});
