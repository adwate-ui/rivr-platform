import type { Limits, MemberFacts, Reward } from '@rivr/contracts/promotionModel';
import { err, ok, type Result } from '@rivr/contracts/result';
import { clubDay, weekOf } from '../clubDay/clubDay.ts';
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
 * grants given, the members given it this club day and whether this member is one, whether this member already has
 * a grant with the event's period key, and the grants at the event's table this club day (null away from a table).
 */
export interface GrantTally {
  readonly chipsGiven: number;
  readonly grantsGiven: number;
  readonly membersToday: number;
  readonly isMemberGrantedToday: boolean;
  readonly isPeriodTaken: boolean;
  readonly grantsAtTableToday: number | null;
}

/** Why the limits stop a grant the reward would give. */
export type LimitRefusal = 'already_given' | 'first_n_taken' | 'members_per_day' | 'max_grants' | 'budget_exhausted';

type EventWhen = Pick<PromotionEvent, 'key' | 'at' | 'visitId'>;

/**
 * The period a member's grant counts in, which the database keeps unique per promotion and member (decision 0437):
 * the visit, the club day, the club week (Monday to Sunday), once ever; with no limit, the event itself, so an event
 * replayed gives nothing more.
 */
export function periodKey(limits: Pick<Limits, 'perMember'>, event: EventWhen): string {
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

const chipsIn = (ledger: Ledger) => ledger.reduce((total, entry) => total + entry.chips, 0);

/** What is left of the promotion's budget in bonus chips over all its versions, never below nothing; null with no budget. */
export function remainingBudget(promo: { readonly limits: Limits }, ledger: Ledger): number | null {
  const budget = promo.limits.budgetChips;
  return budget === undefined ? null : Math.max(0, budget - chipsIn(ledger));
}

/** The tally for one more grant to the event's member, from the promotion's ledger. */
export function tallyFor(promo: { readonly limits: Limits }, ledger: Ledger, event: PromotionEvent): GrantTally {
  const day = clubDay(event.at);
  const today = ledger.filter((entry) => entry.clubDay === day);
  const key = periodKey(promo.limits, event);
  return {
    chipsGiven: chipsIn(ledger),
    grantsGiven: ledger.length,
    membersToday: new Set(today.map((entry) => entry.memberId)).size,
    isMemberGrantedToday: today.some((entry) => entry.memberId === event.memberId),
    isPeriodTaken: ledger.some((entry) => entry.memberId === event.memberId && entry.periodKey === key),
    grantsAtTableToday: event.tableId === null ? null : today.filter((entry) => entry.tableId === event.tableId).length,
  };
}

/** A grant as it enters the ledger. */
export function ledgerEntryFor(promo: { readonly limits: Limits }, event: PromotionEvent, grant: Grant): LedgerEntry {
  return { ...grant, memberId: event.memberId, clubDay: clubDay(event.at), periodKey: periodKey(promo.limits, event), tableId: event.tableId };
}

type LimitCheck = (promo: { readonly reward: Reward; readonly limits: Limits }, grant: Grant, tally: GrantTally) => boolean;

const firstNOf = (reward: Reward) => (reward.kind === 'buyin_bonus' ? reward.firstNBuyinsPerTable : undefined);

// In order: the first broken limit is the reason.
const LIMITS: readonly (readonly [LimitRefusal, LimitCheck])[] = [
  ['already_given', (_, __, tally) => tally.isPeriodTaken],
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
 * Whether a promotion's limits let a grant through (decision 0437): the member's period not yet given, among the first
 * N buy-ins at the table this club day, within the members a day (a member already given it today is not a new one)
 * and the most grants, and the whole grant within what is left of the budget in bonus chips, never part of it. The
 * database's private.promo_check_limits is proved equal on promotionRewards.json; its unique period key holds the
 * per-member limit under concurrency.
 */
export function checkLimits(promo: { readonly reward: Reward; readonly limits: Limits }, grant: Grant, tally: GrantTally): Result<Grant, LimitRefusal> {
  const broken = LIMITS.find(([, isBroken]) => isBroken(promo, grant, tally));
  return broken === undefined ? ok(grant) : err(broken[0]);
}

/** Why a promotion gives a member nothing for an event. */
export type Refusal = 'not_eligible' | GrantRefusal | LimitRefusal;

/** Whether, and what, a promotion gives a member for an event, given its tally: eligible, then its reward, then its limits. */
export function decideGrant(promo: Terms, member: MemberFacts, event: PromotionEvent, tally: GrantTally): Result<Grant, Refusal> {
  if (!isEligible(promo, member, event)) return err('not_eligible');
  const grant = computeGrant(promo, event);
  return grant.ok ? checkLimits(promo, grant.value, tally) : grant;
}
