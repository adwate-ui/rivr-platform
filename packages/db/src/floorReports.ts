import { useQuery } from '@tanstack/react-query';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

// What the floor reads beside the live lists: games not running (#113).

/**
 * A closed table (#113, decision 0184; a table's own list since decision 0467): its waitlist is its interest list. How many
 * wait, how many the venue wants before opening it (null when not set), and whether that many wait.
 */
export interface InterestList {
  readonly tableId: string;
  readonly waiting: number;
  readonly playersToOpen: number | null;
  readonly isReady: boolean;
}

// As the waitlist board: the floor's lists ask again every ten seconds.
const INTEREST_CHECK = 10_000;

/** The venue's closed active tables, with their interest, for staff with waitlist.manage. */
export function useInterestLists(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.interestLists(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    refetchInterval: INTEREST_CHECK,
    queryFn: async (): Promise<InterestList[]> => {
      const { data, error } = await client.rpc('interest_lists', { p_venue_id: venueId });
      if (error) throw error;
      return data.map((row) => ({ tableId: row.table_id, waiting: row.waiting, playersToOpen: row.players_to_open, isReady: row.is_ready }));
    },
  });
}

/** A hand's variant, as the tablet logs it. */
