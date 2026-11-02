import { useQuery } from '@tanstack/react-query';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/** Read every ten seconds on every console screen, so staff learn of new work without opening its screen (decision 0301). */
const QUEUES_LIVE = 10_000;

/**
 * How many wait in each queue the signed-in staff member acts on, by the console rail entry they show beside
 * (`staff_queue_counts`, decision 0301): join requests, top-ups, food and drink orders, the leaving list, checks to
 * review, redemptions, feedback, promotions to approve, the host queue and tournament interest. A queue with nothing
 * waiting, or one the staff member does not act on, is absent.
 */
export function useStaffQueueCounts(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.staffQueueCounts(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    refetchInterval: QUEUES_LIVE,
    // Also while the console sits in a background tab: that is when the tab's count and the chime matter.
    refetchIntervalInBackground: true,
    queryFn: async (): Promise<Readonly<Record<string, number>>> => {
      const { data, error } = await client.rpc('staff_queue_counts', { p_venue_id: venueId });
      if (error) throw error;
      return Object.fromEntries(data.map((row) => [row.queue, row.waiting]));
    },
  });
}
