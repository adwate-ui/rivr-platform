import { err, ok, type Result } from '@rivr/contracts/result';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';
import { failureOf, type WaitlistFailure } from './waitlist.ts';

// Read as often as the floor's tables, which the seat map sits beside.
const LIVE = 10_000;

/**
 * The seat numbers taken at each table of the member's venue (`floor_taken_seats`, with the live floor): a player in the
 * seat or a seat held for a called member. Numbers only: the join sheet's seat map (decision 0320).
 */
export function useFloorTakenSeats() {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.floorTakenSeats(userId ?? 'signed-out'),
    enabled: userId !== null,
    refetchInterval: LIVE,
    queryFn: async (): Promise<ReadonlyMap<string, readonly number[]>> => {
      const { data, error } = await client.rpc('floor_taken_seats');
      if (error) throw error;
      const taken = new Map<string, number[]>();
      for (const row of data) taken.set(row.table_id, [...(taken.get(row.table_id) ?? []), row.seat]);
      return taken;
    },
  });
}

/** A seat called for the member (decision 0321): "I'm on my way" tells the floor. Declining is leaving the list. */
export function useSeatCallActions() {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  const acceptCall = useMutation({
    mutationFn: async (entryId: string): Promise<Result<null, WaitlistFailure>> => {
      const { error } = await client.rpc('accept_seat_call', { p_entry_id: entryId });
      await queryClient.invalidateQueries({ queryKey: queryKeys.myWaitlist(userId ?? 'signed-out') });
      return error ? err(failureOf(error)) : ok(null);
    },
  });
  return { acceptCall };
}
