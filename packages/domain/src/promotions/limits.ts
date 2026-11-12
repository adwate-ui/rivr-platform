import type { Limits, MemberFacts, Reward } from '@rivr/contracts/promotionModel';
import { err, ok, type Result } from '@rivr/contracts/result';
import { clubDay, weekOf } from '../clubDay/clubDay.ts';
import { hourSteps } from './hourSteps.ts';
import { isEligible } from './eligibility.ts';
import { computeGrant, type Grant, type GrantRefusal, type PromotionEvent } from './grant.ts';
import type { Terms } from './terms.ts';

/** One grant a promotion gave, across all its versions: to whom, on which club day, under which period key, where, and what. */
export interface LedgerEntry extends Grant {
  readonly memberId: string;
  readonly clubDay: string;
  readonly periodKey: string;
  readonly tableId: string | null;
}
export type Ledger = readonly LedgerEntry[];

/**
 * What a promotion's grants so far say about one more, as the database counts them from promotion_grant: the chips and
 * grants given (this calendar month of club days for a monthly budget, decision 0499), the members given it this club
 * day and whether this member is one, how many grants this member has in the event's period, and the grants at the
 * event's table this club day (null away from a table).
 */
export interface GrantTally {
  readonly chipsGiven: number;
  readonly grantsGiven: number;
  readonly membersToday: number;
  readonly isMemberGrantedToday: boolean;
  readonly periodGiven: number;
  readonly grantsAtTableToday: number | null;
}

/** Why the limits stop a grant the reward would give. */
export type LimitRefusal = 'already_given' | 'tiers_used_up' | 'first_n_taken' | 'members_per_day' | 'max_grants' | 'budget_exhausted';

/**
 * A tiered seat bonus's chips for the next claim (the owner, 12 Nov; decision 0580): those of the tier the claims so far fall
 * in, the first `count` claims the first tier's; null once every tier is used up. private.promo_tier_chips is its twin.
 */
export function tierChips(tiers: readonly { readonly count: number; readonly chips: number }[], claimed: number): number | null {
  let upTo = 0;
  for (const tier of tiers) {
    upTo += tier.count;
    if (claimed < upTo) return tier.chips;
  }
  return null;
}

/** The grant at its tier's chips, for a seat bonus in tiers with one left; as it is otherwise. */
function atTier(reward: Reward, grant: Grant, tally: GrantTally): Grant {
  const chips = reward.kind === 'seat_bonus' && 'tiers' in reward ? tierChips(reward.tiers, tally.grantsGiven) : null;
  return chips === null ? grant : { ...grant, chips };
}

type EventWhen = Pick<PromotionEvent, 'key' | 'at' | 'visitId'> & { readonly stepMinutes?: number };

/**
 * Where a play-time bonus step stands among its promotion's steps, the first 1 (the owner, 9 Nov): a version that moves a
 * step's minutes keeps it the same step, so an edit never pays it twice. Its minutes where the reward has no such step.
 */
function stepKeyOf(reward: Reward | undefined, stepMinutes: number): number {
  if (reward?.kind !== 'hours_bonus') return stepMinutes;
  const at = hourSteps(reward).findIndex((step) => step.afterMinutes === stepMinutes);
  return at === -1 ? stepMinutes : at + 1;
}

/**
 * The period a member's grant counts in, which the database keeps unique per promotion and member (decision 0471):
 * the visit, the club day, the club week (Monday to Sunday), once ever; with no limit, the event itself, so an event
 * replayed gives nothing more. A play-time bonus step counts in its own: the period and `@` its place among the steps
 * (owner, 8 and 9 Nov), so the member limit holds for each step across the promotion's versions; with no limit, a step's
 * period is its visit, as a step is paid once a visit at most.
 */
export function periodKey(limits: Pick<Limits, 'perMember'>, event: EventWhen, reward?: Reward): string {
  if (event.stepMinutes === undefined) return basePeriod(limits, event);
  const base = limits.perMember === 'none' ? `visit:${event.visitId ?? event.key}` : basePeriod(limits, event);
  return `${base}@${String(stepKeyOf(reward, event.stepMinutes))}`;
}

function basePeriod(limits: Pick<Limits, 'perMember'>, event: EventWhen): string {
  switch (limits.perMember) {
    case 'per_visit':
      return `visit:${event.visitId ?? event.key}`;
    case 'per_day':
      return `day:${clubDay(event.at)}`;
    case 'per_week':
      return `week:${weekOf(clubDay(event.at))}`;
    case 'once':
      return 'once';
    default:
      return `event:${event.key}`;
  }
}

/**
 * The key of a member's next grant in a period, given how many they have in it (decision 0499): the period's own key for
 * the first, then `#2`, `#3` and on, so the database's unique key still holds each one under concurrency.
 */
export function slotKey(base: string, given: number): string {
  return given === 0 ? base : `${base}#${String(given + 1)}`;
}

/** Whether a grant's key is one of a period's: its own key or a numbered one after it. */
const isInPeriod = (key: string, base: string) => key === base || key.startsWith(`${base}#`);

const chipsIn = (ledger: Ledger) => ledger.reduce((total, entry) => total + entry.chips, 0);

/** The grants the budget and the most grants count: all of them, or for a monthly budget those of the club day's calendar month. */
function counted(limits: Limits, ledger: Ledger, day: string): Ledger {
  return limits.budgetPeriod === 'month' ? ledger.filter((entry) => entry.clubDay.slice(0, 7) === day.slice(0, 7)) : ledger;
}

/**
 * What is left of the promotion's budget in bonus chips on a club day, over all its versions (that day's month for a
 * monthly budget), never below nothing; null with no budget.
 */
export function remainingBudget(promo: { readonly limits: Limits }, ledger: Ledger, day: string): number | null {
  const budget = promo.limits.budgetChips;
  return budget === undefined ? null : Math.max(0, budget - chipsIn(counted(promo.limits, ledger, day)));
}

/** The tally for one more grant to the event's member, from the promotion's ledger. */
export function tallyFor(promo: { readonly limits: Limits; readonly reward?: Reward }, ledger: Ledger, event: PromotionEvent): GrantTally {
  const day = clubDay(event.at);
  const today = ledger.filter((entry) => entry.clubDay === day);
  const inBudget = counted(promo.limits, ledger, day);
  const key = periodKey(promo.limits, event, promo.reward);
  return {
    chipsGiven: chipsIn(inBudget),
    grantsGiven: inBudget.length,
    membersToday: new Set(today.map((entry) => entry.memberId)).size,
    isMemberGrantedToday: today.some((entry) => entry.memberId === event.memberId),
    periodGiven: ledger.filter((entry) => entry.memberId === event.memberId && isInPeriod(entry.periodKey, key)).length,
    grantsAtTableToday: event.tableId === null ? null : today.filter((entry) => entry.tableId === event.tableId).length,
  };
}

/** A grant as it enters the ledger, keyed as the member's next in its period. */
export function ledgerEntryFor(
  promo: { readonly limits: Limits; readonly reward?: Reward }, event: PromotionEvent, grant: Grant, tally: Pick<GrantTally, 'periodGiven'>,
): LedgerEntry {
  const key = slotKey(periodKey(promo.limits, event, promo.reward), tally.periodGiven);
  return { ...grant, memberId: event.memberId, clubDay: clubDay(event.at), periodKey: key, tableId: event.tableId };
}

type LimitCheck = (promo: { readonly reward: Reward; readonly limits: Limits }, grant: Grant, tally: GrantTally) => boolean;

function firstNOf(reward: Reward): number | undefined {
  if (reward.kind === 'seat_bonus') return 'tiers' in reward ? undefined : reward.firstNSeatsPerTable;
  return reward.kind === 'buyin_bonus' ? reward.firstNBuyinsPerTable : undefined;
}

// In order: the first broken limit is the reason.
const LIMITS: readonly (readonly [LimitRefusal, LimitCheck])[] = [
  ['already_given', ({ limits, reward }, _, tally) => tally.periodGiven >= (limits.timesPerMember ?? 1)
    // One of a seat bonus's first N a member, a club day: one member never takes the table's places (decision 0543).
    || (reward.kind === 'seat_bonus' && firstNOf(reward) !== undefined && tally.isMemberGrantedToday)],
  // A seat bonus in tiers pays nothing once its last tier is claimed (decision 0580).
  ['tiers_used_up', ({ reward }, _, tally) => reward.kind === 'seat_bonus' && 'tiers' in reward && tierChips(reward.tiers, tally.grantsGiven) === null],
  ['first_n_taken', ({ reward }, _, tally) => {
    const firstN = firstNOf(reward);
    return firstN !== undefined && (tally.grantsAtTableToday === null || tally.grantsAtTableToday >= firstN);
  }],
  ['members_per_day', ({ limits }, _, tally) =>
    limits.maxMembersPerDay !== undefined && !tally.isMemberGrantedToday && tally.membersToday >= limits.maxMembersPerDay],
  ['max_grants', ({ limits }, _, tally) => limits.maxGrants !== undefined && tally.grantsGiven >= limits.maxGrants],
  ['budget_exhausted', ({ limits }, grant, tally) => limits.budgetChips !== undefined && tally.chipsGiven + grant.chips > limits.budgetChips],
];

/**
 * Whether a promotion's limits let a grant through (decisions 0471 and 0499): the member given it fewer times in the
 * period than it allows (once unless it says up to N), among the first N buy-ins or seats at the table this club day, within the
 * members a day (a member already given it today is not a new one) and the most grants, and the whole grant within what
 * is left of the budget in bonus chips, never part of it; a monthly budget's tally counts the month alone. The
 * database's private.promo_check_limits is proved equal on promotionRewards.json; its unique period key, numbered for
 * each grant in a period (slotKey), holds the per-member limit under concurrency.
 */
export function checkLimits(promo: { readonly reward: Reward; readonly limits: Limits }, grant: Grant, tally: GrantTally): Result<Grant, LimitRefusal> {
  // A seat bonus in tiers gives its tier's chips, which the budget then counts (decision 0580).
  const tiered = atTier(promo.reward, grant, tally);
  const broken = LIMITS.find(([, isBroken]) => isBroken(promo, tiered, tally));
  return broken === undefined ? ok(tiered) : err(broken[0]);
}

/** Why a promotion gives a member nothing for an event. */
export type Refusal = 'not_eligible' | GrantRefusal | LimitRefusal;

/** Whether, and what, a promotion gives a member for an event, given its tally: eligible, then its reward, then its limits. */
export function decideGrant(promo: Terms, member: MemberFacts, event: PromotionEvent, tally: GrantTally): Result<Grant, Refusal> {
  if (!isEligible(promo, member, event)) return err('not_eligible');
  const grant = computeGrant(promo, event);
  return grant.ok ? checkLimits(promo, grant.value, tally) : grant;
}
