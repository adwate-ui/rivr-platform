import type { Eligibility, MemberFacts, Reward } from '@rivr/contracts/promotionModel';
import { isInSchedule } from './schedule.ts';
import type { Terms } from './terms.ts';

/** Where and when the event happened: its moment, and the stake and table, or null away from a table. */
export interface EligibilityContext {
  readonly at: Date;
  readonly stake: string | null;
  readonly tableId: string | null;
}

/** "New members, first 30 days": members fewer than 30 whole days since joining. */
export const NEW_MEMBER_DAYS = 30;
/** "Lapsed regulars": members whose last visit before this one was at least 30 days ago. */
export const LAPSED_DAYS = 30;

function isListed(allowed: 'all' | readonly string[] | undefined, value: string | null): boolean {
  return allowed === undefined || allowed === 'all' || (value !== null && allowed.includes(value));
}

function isInAudience(audience: Eligibility['audience'], member: MemberFacts): boolean {
  switch (audience) {
    case 'new_30d':
      return member.daysSinceJoined < NEW_MEMBER_DAYS;
    case 'lapsed':
      return member.daysSinceLastVisit !== null && member.daysSinceLastVisit >= LAPSED_DAYS;
    case 'women':
      return member.isWoman === true;
    default:
      return true;
  }
}

/** Rewards for time played: the minutes inside the schedule, at its stakes and tables, decide them, not the moment of the event. */
export function isTimeBased(reward: Reward): boolean {
  return reward.kind === 'points_multiplier' || reward.kind === 'hours_bonus' || reward.kind === 'free_spin';
}

/** Whether a table is one the promotion runs at: any, or one of its stakes and tables. A promotion for some stakes runs at no table-less event. */
export function isAtEligibleTable(eligibility: Eligibility, stake: string | null, tableId: string | null): boolean {
  return isListed(eligibility.stakes, stake) && isListed(eligibility.tableIds, tableId);
}

/**
 * Whether a member qualifies for a promotion at an event (decision 0472): their tier and audience are the promotion's,
 * and, for an event at a moment (a buy-in, a visit, a referral, a sign-up), its stake, table and moment are too. For a
 * time-played reward the stake, table and schedule decide which minutes count (secondsInSchedule at isAtEligibleTable),
 * so a visit that closes after the window still qualifies. The database's private.promo_is_eligible is proved equal on
 * promotionRewards.json.
 */
export function isEligible(promo: Pick<Terms, 'reward' | 'eligibility' | 'schedule'>, member: MemberFacts, context: EligibilityContext): boolean {
  const { eligibility } = promo;
  if (!isListed(eligibility.tiers, member.tierId) || !isInAudience(eligibility.audience, member)) return false;
  if (isTimeBased(promo.reward)) return true;
  return isAtEligibleTable(eligibility, context.stake, context.tableId) && isInSchedule(promo.schedule, context.at);
}
