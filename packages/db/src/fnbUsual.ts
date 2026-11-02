import { useQuery } from '@tanstack/react-query';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/**
 * "Your usual" on the Order screen (decision 0320): the ids of the two items the member ordered most over 90 days, most
 * first (`my_usual_fnb_items`, with fnb.table_side); none without history.
 */
export function useMyUsualFnbItems() {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.myUsualFnbItems(userId ?? 'signed-out'),
    enabled: userId !== null,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await client.rpc('my_usual_fnb_items');
      if (error) throw error;
      return data.map((row) => row.item_id);
    },
  });
}
