import type { PromotionBuilder, PromotionConditions, PromotionEffect, PromotionTrigger } from '@rivr/contracts/promotions';

/** A promotion as the builder publishes it: its one rule, and a per-player limit (null for none). */
export interface PromotionDraft {
  readonly rule: { readonly trigger: PromotionTrigger; readonly conditions: PromotionConditions; readonly effect: PromotionEffect };
  readonly perPlayer: { readonly limit: number; readonly period: 'day' | 'promotion' } | null;
}

const POINTS: Record<'double_points' | 'triple_points', PromotionEffect> = {
  double_points: { kind: 'points', multiplier_percent: 200 },
  triple_points: { kind: 'points', multiplier_percent: 300 },
};

// Rupees in paise.
const PAISE_PER_RUPEE = 100;

/** The reward's trigger and effect: points on hours played, or 10% of a buy-in as bonus up to the cap, for a week. */
function rewardFor(choices: PromotionBuilder): { trigger: PromotionTrigger; effect: PromotionEffect } {
  if (choices.reward !== 'buy_in_bonus') return { trigger: 'hours_played', effect: POINTS[choices.reward] };
  return { trigger: 'buy_in', effect: { kind: 'bonus', percent_bps: 1_000, cap_paise: choices.bonus_cap_rupees * PAISE_PER_RUPEE, expires_days: 7 } };
}

// The first 50 a club day; the prototype's "First 50 members", so one each: 50 grants are 50 members.
const FIRST_FIFTY = { count: 50, per: 'day' } as const;

const PER_PLAYER: Record<PromotionBuilder['limit'], PromotionDraft['perPlayer']> = {
  none: null,
  first_50: { limit: 1, period: 'day' },
  once_per_member: { limit: 1, period: 'promotion' },
};

/** When and who as conditions: only what was chosen, so nothing chosen is every day and every stake. */
function conditionsFor(choices: PromotionBuilder): PromotionConditions {
  return {
    ...(choices.days.length > 0 ? { days: [...choices.days].sort((a, b) => a - b) } : {}),
    ...(choices.from !== null && choices.until !== null ? { from: choices.from, until: choices.until } : {}),
    ...(choices.stake !== null ? { stakes: [choices.stake] } : {}),
    ...(choices.limit === 'first_50' ? { first_n: FIRST_FIFTY } : {}),
  };
}

/**
 * The builder's four blocks as a promotion rule (#84; design prompt Promotions, flow 7). Double and
 * triple points multiply the points earned for hours played; the buy-in bonus is 10% of a buy-in as
 * bonus for a week, no more than the cap on one buy-in (decision 0141, question #415). "First 50 members" is the first 50 grants a club
 * day, one a member; "Once per member" one grant each over the whole promotion. Flow 7 (Thursday
 * 14:00 to 20:00, 100/200, double points, no limits) is hours played on day 4 in that window at
 * nlh_100_200, points at 200%.
 */
export function promotionDraft(choices: PromotionBuilder): PromotionDraft {
  const { trigger, effect } = rewardFor(choices);
  return {
    rule: { trigger, conditions: conditionsFor(choices), effect },
    perPlayer: PER_PLAYER[choices.limit],
  };
}
