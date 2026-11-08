import { useQuery } from '@tanstack/react-query';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/** How many of each reward went in the last 30 days, by reward id, cancelled ones left out, for staff who keep the catalogue or hand rewards over (F-072). */
export function useRewardRedemptionCounts(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.rewardRedemptionCounts(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    queryFn: async (): Promise<ReadonlyMap<string, number>> => {
      const { data, error } = await client.rpc('reward_redemption_counts', { p_venue_id: venueId });
      if (error) throw error;
      return new Map(data.map((row) => [row.reward_item_id, row.redeemed]));
    },
  });
}
