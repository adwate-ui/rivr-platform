import { isPositive, type Paise } from '../money/index.ts';

/**
 * What Refer a friend may say (redesign of 15 Nov 2026, RD-20): a reward of this much Bonus each, or the invite alone, with
 * no word of a reward.
 */
export type ReferralPromise = { readonly kind: 'reward'; readonly bonus: Paise } | { readonly kind: 'invite' };

/**
 * A reward is promised only while a referral promotion is live. `liveBonus` is what that promotion gives each side now, as
 * the server reads it; null while none is live. A live promotion that gives nothing promises nothing either.
 */
export function referralPromise(liveBonus: Paise | null): ReferralPromise {
  return liveBonus !== null && isPositive(liveBonus) ? { kind: 'reward', bonus: liveBonus } : { kind: 'invite' };
}
