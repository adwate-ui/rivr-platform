import { err, ok, type Result } from '@rivr/contracts/result';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/** A stake the builder's Who section offers: a table type's code and name ("NLH 100/200", "Private Room"). */
export interface PromotionStake {
  readonly code: string;
  readonly name: string;
}

/** Why a pause or resume of a promotion run by its rule did not go through. */
export type PromotionFailure = 'not_allowed' | 'invalid' | 'switched_off' | 'paused' | 'unavailable';

const FAILURE_BY_CODE: Readonly<Record<string, PromotionFailure>> = {
  '42501': 'not_allowed', '22023': 'invalid', '23514': 'invalid', RVVER: 'invalid', RVKIL: 'switched_off', RVFRZ: 'paused',
};

/** The venue's table types, lowest blinds first, for the builder's Who section. */
export function usePromotionStakes(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.promotionStakes(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    queryFn: async (): Promise<PromotionStake[]> => {
      const { data, error } = await client.from('table_type').select('code, name').eq('venue_id', venueId)
        .order('small_blind_paise').order('name');
      if (error) throw error;
      return data.map((row) => ({ code: row.code, name: row.name }));
    },
  });
}

/**
 * Pauses or resumes a promotion still run by its rule, made before versions (decision 0461): a card that is only words,
 * such as high hands (`set_promotion_live`). A promotion in versions pauses through its version
 * (`usePromotionVersionActions`). The console's list reloads after each.
 */
export function usePromotionActions(venueId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  const setLive = useMutation({
    mutationFn: async ({ id, isLive }: { id: string; isLive: boolean }): Promise<Result<null, PromotionFailure>> => {
      const { error } = await client.rpc('set_promotion_live', { p_promotion_id: id, p_is_live: isLive });
      await queryClient.invalidateQueries({ queryKey: queryKeys.promotionsOverview(userId ?? 'signed-out', venueId) });
      return error ? err(FAILURE_BY_CODE[error.code] ?? 'unavailable') : ok(null);
    },
  });
  return { setLive };
}
