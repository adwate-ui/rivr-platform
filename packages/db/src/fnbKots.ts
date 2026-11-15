import { useQuery } from '@tanstack/react-query';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

// The bar works through orders by the ten seconds, so what it is told is asked again as often.
const ORDERS_CHECK = 10_000;

/** The KOTs members cancelled themselves tonight, the last three (F-048), newest first, so the bar can drop one it already holds. */
export function useMemberCancelledKots(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: [...queryKeys.fnbOrdersTonight(userId ?? 'signed-out', venueId), 'member-cancelled'],
    enabled: userId !== null,
    refetchInterval: ORDERS_CHECK,
    queryFn: async (): Promise<number[]> => {
      const { data, error } = await client.rpc('fnb_member_cancelled_kots', { p_venue_id: venueId });
      if (error) throw error;
      return data.map((row) => row.kot_number);
    },
  });
}
