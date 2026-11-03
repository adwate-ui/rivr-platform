import type { Grant, Perk } from './grant.ts';

/** A promotion whose grant for one event passed its own limits, in the engine's order (oldest promotion first). */
export interface StackCandidate {
  readonly promotionId: string;
  readonly grant: Grant;
}

/** The multiplier grant giving the most points; the first on a tie. */
function bestMultiplier(candidates: readonly StackCandidate[]): StackCandidate | undefined {
  return candidates.reduce<StackCandidate | undefined>(
    (best, candidate) => (candidate.grant.points > (best?.grant.points ?? 0) ? candidate : best),
    undefined,
  );
}

/**
 * Which promotions to give for one event (decision 0470), in the order given: at most one points multiplier, the one
 * giving the most points, the first on a tie; bonus chips and spins from different promotions all stack, each within
 * its own limits; one perk of each kind, the first. The database's private.promo_stack is proved equal on
 * promotionRewards.json.
 */
export function stackGrants(candidates: readonly StackCandidate[]): string[] {
  const best = bestMultiplier(candidates);
  const perks = new Set<Perk>();
  return candidates
    .filter((candidate) => {
      const { points, perk } = candidate.grant;
      if (points > 0) return candidate === best;
      if (perk === null) return true;
      const isFirstOfKind = !perks.has(perk);
      perks.add(perk);
      return isFirstOfKind;
    })
    .map((candidate) => candidate.promotionId);
}
