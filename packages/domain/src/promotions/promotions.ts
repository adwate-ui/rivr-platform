import type { PromotionConditions, PromotionEffect } from '@rivr/contracts/promotions';
import { compare, fromPaise, min, roundDownToChip, shareOf, ZERO, type Paise } from '../money/index.ts';

/** What the database knows when a rule is weighed (#83): the moment, the member's tier, table and visits, and the promotion's grants today. */
export interface PromotionFacts {
  readonly at: Date;
  readonly tierId: string | null;
  /** The table type's code at the member's table, such as nlh_100_200; null away from a table. */
  readonly stake: string | null;
  readonly tableId: string | null;
  readonly visitsInMonth: number;
  /** Whole days since the member's last visit before this one; null for a new player. */
  readonly daysSinceLastVisit: number | null;
  readonly isCallTimeComplete: boolean;
  /** The promotion's grants already given this club day, anywhere and at the member's table. */
  readonly grantedToday: number;
  readonly grantedTodayAtTable: number;
  /** From the event: hours played this visit (hours played), and the hand (hand logged). */
  readonly hoursPlayed: number;
  readonly hand: string | null;
}

export const MINUTES_IN_DAY = 1440;
// The club's day turns over at 06:00 IST. IST is UTC+05:30, so the club's clock runs at UTC-00:30.
export const CLUB_CLOCK_OFFSET_MS = -30 * 60 * 1000;
const CLUB_DAY_STARTS_MINUTE = 6 * 60;

/** The club's day (ISO, 1 Monday to 7 Sunday) and minutes into it at a moment: 02:00 on Wednesday is Tuesday's minute 1200. */
function clubClock(at: Date): { day: number; minute: number } {
  const clock = new Date(at.getTime() + CLUB_CLOCK_OFFSET_MS);
  return { day: clock.getUTCDay() === 0 ? 7 : clock.getUTCDay(), minute: clock.getUTCHours() * 60 + clock.getUTCMinutes() };
}

/** A 24-hour IST time ("14:00") as minutes into the club's day. */
export function clubMinute(time: string): number {
  const [hours = 0, minutes = 0] = time.split(':').map(Number);
  return (hours * 60 + minutes - CLUB_DAY_STARTS_MINUTE + MINUTES_IN_DAY) % MINUTES_IN_DAY;
}

/** Inside the window: from its start up to, not including, its end; an end at 06:00 is the end of the club's day. */
function isInWindow(conditions: PromotionConditions, minute: number): boolean {
  if (conditions.from === undefined || conditions.until === undefined) return true;
  const until = clubMinute(conditions.until) || MINUTES_IN_DAY;
  return minute >= clubMinute(conditions.from) && minute < until;
}

function isListed<T>(allowed: readonly T[] | undefined, value: T | null): boolean {
  return allowed === undefined || (value !== null && allowed.includes(value));
}

function isAmongFirst(firstN: PromotionConditions['first_n'], facts: PromotionFacts): boolean {
  if (firstN === undefined) return true;
  if (firstN.per === 'day') return facts.grantedToday < firstN.count;
  return facts.tableId !== null && facts.grantedTodayAtTable < firstN.count;
}

function isVisitorAsAsked(conditions: PromotionConditions, facts: PromotionFacts): boolean {
  const days = facts.daysSinceLastVisit;
  if (conditions.new_player === true && days !== null) return false;
  if (conditions.lapsed_days !== undefined && (days === null || days < conditions.lapsed_days)) return false;
  return facts.visitsInMonth >= (conditions.min_visits_in_month ?? 0);
}

/**
 * Whether a rule applies (scope-v1 module 7): every condition it names holds, so a rule with none
 * always applies. Days and times are the club's, 06:00 to 06:00 IST; visits in the month are closed
 * ones with play (lane C's private.visits_this_month, decision 0180). The database's
 * private.promotion_applies is proved equal by packages/testing/golden/promotions.json.
 */
export function promotionApplies(conditions: PromotionConditions, facts: PromotionFacts): boolean {
  const clock = clubClock(facts.at);
  return [
    isListed(conditions.tier_ids, facts.tierId),
    isListed(conditions.stakes, facts.stake),
    isListed(conditions.table_ids, facts.tableId),
    isListed(conditions.days, clock.day),
    isInWindow(conditions, clock.minute),
    isAmongFirst(conditions.first_n, facts),
    isVisitorAsAsked(conditions, facts),
    conditions.call_time_complete === undefined || facts.isCallTimeComplete,
    facts.hoursPlayed >= (conditions.min_hours ?? 0),
    isListed<string>(conditions.hands, facts.hand),
  ].every(Boolean);
}

/** What a rule gives for one event: its rupee cost, counted against the promotion's budget, and points. */
export interface PromotionReward {
  readonly cost: Paise;
  readonly points: bigint;
}

type BonusEffect = Extract<PromotionEffect, { kind: 'bonus' }>;
type PointsEffect = Extract<PromotionEffect, { kind: 'points' }>;

/** A fixed bonus, or the share of the amount rounded down to whole ₹50 chips and held to the cap. */
function bonusAmount(effect: BonusEffect, amount: Paise): Paise {
  if ('amount_paise' in effect) return fromPaise(BigInt(effect.amount_paise));
  const share = roundDownToChip(shareOf(amount, BigInt(effect.percent_bps)));
  return effect.cap_paise === undefined ? share : min(share, fromPaise(BigInt(effect.cap_paise)));
}

/** Fixed points, or the extra of the multiplier on the points earned, rounded down: double on 120 is 120 more. */
function extraPoints(effect: PointsEffect, earned: bigint): bigint {
  if ('points' in effect) return BigInt(effect.points);
  return (earned * BigInt(effect.multiplier_percent - 100)) / 100n;
}

/**
 * What a rule's effect gives for an event with this amount (a buy-in) and these points earned, or
 * null when a bonus or points come to nothing. A cab, a spin, a ticket or a message costs ₹0; a
 * prize its value; a jackpot payout its amount. The database's private.promotion_reward is proved
 * equal by packages/testing/golden/promotions.json.
 */
export function promotionReward(effect: PromotionEffect, earned: { amount: Paise; points: bigint }): PromotionReward | null {
  switch (effect.kind) {
    case 'bonus': {
      const bonus = bonusAmount(effect, earned.amount);
      return bonus > 0n ? { cost: bonus, points: 0n } : null;
    }
    case 'points': {
      const points = extraPoints(effect, earned.points);
      return points > 0n ? { cost: ZERO, points } : null;
    }
    case 'jackpot_payout':
      return { cost: fromPaise(BigInt(effect.amount_paise)), points: 0n };
    case 'physical_prize':
      return { cost: fromPaise(BigInt(effect.value_paise ?? 0)), points: 0n };
    default:
      return { cost: ZERO, points: 0n };
  }
}

/** A promotion that applies to one event, weighed for giving. A null limit is no limit. */
export interface PromotionCandidate {
  readonly promotion: string;
  readonly stacks: boolean;
  readonly cost: Paise;
  readonly budgetLeft: Paise | null;
  readonly grantsLeft: number | null;
  /** How many more this member may have, under the per-player limit. */
  readonly playerLeft: number | null;
  /** Already given for this event: a replay, or a date window's later minute. */
  readonly isGiven: boolean;
}

function isWithinLimits(candidate: PromotionCandidate): boolean {
  const hasBudget = candidate.budgetLeft === null || compare(candidate.cost, candidate.budgetLeft) <= 0;
  return hasBudget && (candidate.grantsLeft ?? 1) > 0 && (candidate.playerLeft ?? 1) > 0;
}

/**
 * Which of the promotions that apply to one event to give now (scope-v1 module 7 controls), taken in
 * priority order: each while its count budget, rupee budget and per-player limit allow (never part of
 * a reward); one that does not stack only when nothing else has been given for the event, and once it
 * has, nothing more. The database's private.promotions_to_give is proved equal by packages/testing/golden/promotions.json.
 */
export function promotionsToGive(candidates: readonly PromotionCandidate[]): string[] {
  const given = candidates.filter((candidate) => candidate.isGiven);
  const chosen: string[] = [];
  for (const candidate of candidates) {
    if (given.some((one) => !one.stacks)) break;
    if (candidate.isGiven || (!candidate.stacks && given.length > 0) || !isWithinLimits(candidate)) continue;
    given.push(candidate);
    chosen.push(candidate.promotion);
  }
  return chosen;
}
