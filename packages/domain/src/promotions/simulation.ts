import type { MemberFacts, PromotionSimulationResult } from '@rivr/contracts/promotionModel';
import { isEligible } from './eligibility.ts';
import { computeGrant, type PromotionEvent } from './grant.ts';
import { stepsReached } from './hourSteps.ts';
import { checkLimits, ledgerEntryFor, tallyFor, type LedgerEntry, type LimitRefusal } from './limits.ts';
import type { Terms } from './terms.ts';

/** One of last week's events as the replay gives it, with what the promotion knew of the member then. */
export interface ReplayedEvent {
  readonly event: PromotionEvent;
  readonly member: MemberFacts;
}

/** What last week would have given, and every grant, in the order given. */
export interface Simulation extends PromotionSimulationResult {
  readonly grants: readonly LedgerEntry[];
}

// The budget in chips, or the most grants, stopped a grant the promotion would otherwise have given.
const BUDGET_LIMITS: ReadonlySet<LimitRefusal> = new Set(['budget_exhausted', 'max_grants']);

/**
 * The events a promotion weighs: a play-time bonus weighs a step for each one a visit's time played reached (owner, 8
 * Nov), at the visit's close as the replay has no moment within a visit; every other promotion the events as given.
 */
function eventsFor(promo: Terms, replayed: ReplayedEvent): readonly ReplayedEvent[] {
  const { event } = replayed;
  if (promo.reward.kind !== 'hours_bonus' || event.kind !== 'time_played') return [replayed];
  return stepsReached(promo.reward, event.minutes).map((stepMinutes) => ({
    ...replayed,
    event: { ...event, kind: 'hours_step', key: `${event.key.replace(/^hours_played:/, 'hours_step:')}:${String(stepMinutes)}`, minutes: event.minutes, stepMinutes },
  }));
}

const byTime = (one: ReplayedEvent, other: ReplayedEvent) =>
  one.event.at.getTime() - other.event.at.getTime() || (one.event.key < other.event.key ? -1 : Number(one.event.key > other.event.key));

function totalsOf(grants: readonly LedgerEntry[]): Pick<Simulation, 'points' | 'chips' | 'spins' | 'perks'> {
  return {
    points: grants.reduce((total, grant) => total + grant.points, 0),
    chips: grants.reduce((total, grant) => total + grant.chips, 0),
    spins: grants.reduce((total, grant) => total + grant.spins, 0),
    perks: grants.filter((grant) => grant.perk !== null).length,
  };
}

/**
 * Replays a version on last week's events before it is submitted (the brief's simulate; decision 0471): in time order,
 * as the engine weighs them live, each is weighed with isEligible, computeGrant and checkLimits against the grants the
 * replay has given so far, so the replay cannot disagree with the engine. Members qualified are those the promotion
 * would have given something before its limits; times given and the totals are the grants its limits let through. It
 * weighs the one promotion alone: stacking with others is not replayed, so a multiplier's points err high.
 */
export function simulate(promo: Terms, events: readonly ReplayedEvent[]): Simulation {
  const grants: LedgerEntry[] = [];
  const qualified = new Set<string>();
  let isBudgetReached = false;
  for (const { event, member } of events.flatMap((one) => eventsFor(promo, one)).sort(byTime)) {
    const grant = isEligible(promo, member, event) ? computeGrant(promo, event) : null;
    if (grant === null || !grant.ok) continue;
    qualified.add(event.memberId);
    const tally = tallyFor(promo, grants, event);
    const decided = checkLimits(promo, grant.value, tally);
    if (decided.ok) grants.push(ledgerEntryFor(promo, event, decided.value, tally));
    else isBudgetReached ||= BUDGET_LIMITS.has(decided.error);
  }
  return { events: events.length, membersQualified: qualified.size, timesGiven: grants.length, ...totalsOf(grants), isBudgetReached, grants };
}
