import type { Grant, Perk } from './grant.ts';

/** A promotion whose grant for one event passed its own limits, in the engine's order (oldest promotion first). */
export interface StackCandidate {
  readonly promotionId: string;
  readonly grant: Grant;
}

/**
 * Which promotions to give for one event (decision 0470), in the order given: bonus chips from different promotions all
 * stack, each within its own limits; one perk of each kind, the first. The database's private.promo_stack is proved
 * equal on promotionRewards.json.
 */
export function stackGrants(candidates: readonly StackCandidate[]): string[] {
  const perks = new Set<Perk>();
  return candidates
    .filter((candidate) => {
      const { perk } = candidate.grant;
      if (perk === null) return true;
      const isFirstOfKind = !perks.has(perk);
      perks.add(perk);
      return isFirstOfKind;
    })
    .map((candidate) => candidate.promotionId);
}
