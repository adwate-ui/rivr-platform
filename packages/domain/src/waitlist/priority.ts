/**
 * Waitlist priority (scope-v1 module 2, decision S-D11): a scoring rule, never a manual override.
 * Each tier may carry a weight in the effective-dated setting `waitlist.priority_weights`. The black
 * card's applies only on the list for the member's qualifying stake; elsewhere they queue by join
 * time. A list is ordered by weight, highest first, then by join time.
 */

/** Blinds in paise: the list's stake, or a black card's qualifying stake. */
export interface Stake {
  readonly smallBlind: bigint;
  readonly bigBlind: bigint;
}

/** A tier's priority, from the setting: its weight, and whether it counts only at the qualifying stake. */
export interface TierPriority {
  /** The reason shown on the floor: the tier's name, "Black card". */
  readonly reason: string;
  readonly weight: number;
  readonly onlyAtQualifyingStake: boolean;
}

/** What a place's priority depends on. */
export interface PriorityInput {
  /** The member's tier's priority; null for a tier without one. */
  readonly tier: TierPriority | null;
  /** A black card's qualifying stake; null for anyone else. */
  readonly qualifyingStake: Stake | null;
}

/** A place's priority on one list: its weight, and the reason when it has one. */
export interface Priority {
  readonly weight: number;
  readonly reason: string | null;
}

const NONE: Priority = { weight: 0, reason: null };

function sameStake(a: Stake, b: Stake): boolean {
  return a.smallBlind === b.smallBlind && a.bigBlind === b.bigBlind;
}

/** The priority a member has on the list for `stake`. */
export function priorityOn(stake: Stake, { tier, qualifyingStake }: PriorityInput): Priority {
  if (!tier || tier.weight <= 0) return NONE;
  if (tier.onlyAtQualifyingStake && !(qualifyingStake && sameStake(qualifyingStake, stake))) return NONE;
  return { weight: tier.weight, reason: tier.reason };
}

/** A place on a list, as the order needs it. */
export interface WaitingPlace extends PriorityInput {
  readonly id: string;
  /** Epoch milliseconds. */
  readonly joinedAt: number;
}

/** The list for `stake` in order: highest weight first, then earliest joined, then by id so the order is total. */
export function orderWaitlist<Place extends WaitingPlace>(stake: Stake, places: readonly Place[]): (Place & { readonly priority: Priority })[] {
  return places
    .map((place) => ({ ...place, priority: priorityOn(stake, place) }))
    .sort((a, b) => b.priority.weight - a.priority.weight || a.joinedAt - b.joinedAt || a.id.localeCompare(b.id));
}
