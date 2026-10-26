import { useQuery } from '@tanstack/react-query';
import { toPromotionCard, type PromotionCardData } from './promotionCards.ts';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

// The TV reads its cards again every half minute, and at once when one is published or paused.
const TV_CHECK = 30_000;

/** The paired TV's venue's live promotion cards, for its Promotions rotation; read again at once when one is published or paused (useTvSignals). */
export function useTvPromotions() {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.tvPromotions(userId ?? 'signed-out'),
    enabled: userId !== null,
    refetchInterval: TV_CHECK,
    queryFn: async (): Promise<PromotionCardData[]> => {
      const { data, error } = await client.rpc('tv_promotions');
      if (error) throw error;
      return data.map(toPromotionCard);
    },
  });
}
