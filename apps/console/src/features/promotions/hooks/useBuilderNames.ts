import { usePromotionStakes, useVenueTiers, type PromotionStake, type VenueTier } from '@rivr/db';
import type { PromotionNames } from '@rivr/domain/promotions';
import type { TemplateTiers } from '../components/builderForm.ts';

/** The venue's stakes and tiers the builder offers, and the names its words give their codes and ids. */
export interface BuilderNames {
  readonly stakes: readonly PromotionStake[];
  readonly tiers: readonly VenueTier[];
  readonly names: PromotionNames;
  readonly templateTiers: TemplateTiers;
}

export type BuilderNamesState = { readonly status: 'ready'; readonly value: BuilderNames } | { readonly status: 'loading' | 'error'; readonly retry: () => void };

// The tiers the Founders' Circle priority and Graduate freeroll templates are for, as the venue's seed names them.
const FOUNDERS = "Founders' Circle";
const GRADUATE = 'Academy graduate';

/** The stakes and tiers of the venue, read once for the list, the builder and the approver. */
export function useBuilderNames(venueId: string): BuilderNamesState {
  const stakes = usePromotionStakes(venueId);
  const tiers = useVenueTiers(venueId);
  if (stakes.data === undefined || tiers.data === undefined) {
    return { status: stakes.isError || tiers.isError ? 'error' : 'loading', retry: () => void Promise.all([stakes.refetch(), tiers.refetch()]) };
  }
  const venueTiers = tiers.data;
  const tierNamed = (name: string) => venueTiers.find((tier) => tier.name === name)?.tierId ?? null;
  return {
    status: 'ready',
    value: {
      stakes: stakes.data, tiers: venueTiers,
      names: {
        stakes: Object.fromEntries(stakes.data.map((stake) => [stake.code, stake.name])),
        tiers: Object.fromEntries(venueTiers.map((tier) => [tier.tierId, tier.name])),
      },
      templateTiers: { founders: tierNamed(FOUNDERS), graduate: tierNamed(GRADUATE) },
    },
  };
}
