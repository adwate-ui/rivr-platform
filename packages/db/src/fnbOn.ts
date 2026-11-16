import type { Result } from '@rivr/contracts';
import { useQuery, type QueryClient } from '@tanstack/react-query';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/**
 * Whether the venue takes food and drink orders now (`fnb_on`, decision 0681): with no venue, the signed-in member's. Only a
 * known `false` hides ordering: while it is being read, or if it cannot be, ordering shows, and the database refuses an
 * order while F&B is off.
 */
export function useFnbOff(venueId: string | null = null) {
  const { client, userId } = useRivrData();
  const read = useQuery({
    queryKey: queryKeys.fnbOn(userId ?? 'signed-out', venueId ?? 'mine'),
    enabled: userId !== null,
    // Asked again each minute, so a screen left open follows the switch; an order refused for it asks at once.
    staleTime: 60_000,
    refetchInterval: 60_000,
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await client.rpc('fnb_on', venueId === null ? {} : { p_venue_id: venueId });
      if (error) throw error;
      return data;
    },
  });
  return read.data === false;
}

/** An order refused because F&B is off (`fnb_off`): the screens ask again whether it is, and hide ordering. */
export async function seenOff<T, E extends string>(queryClient: QueryClient, userId: string | null, result: Result<T, E>): Promise<Result<T, E>> {
  if (!result.ok && result.error === 'fnb_off') await queryClient.invalidateQueries({ queryKey: queryKeys.fnbOnAll(userId ?? 'signed-out') });
  return result;
}
