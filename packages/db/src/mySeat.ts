import { useQuery } from '@tanstack/react-query';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/**
 * The signed-in member's seat tonight (#78): where, whether away, whether the seat has call time, and
 * the time left (null without call_time.view or call time).
 */
export interface MySeat {
  readonly tableName: string;
  readonly seat: number;
  readonly isAway: boolean;
  readonly hasCallTime: boolean;
  readonly callTimeLeft: number | null;
}

// The time left is read again each half minute; Home shows it to the minute.
const LIVE = 30_000;

/** The member's seat, or null when they are not seated. */
export function useMySeat() {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.mySeat(userId ?? 'signed-out'),
    enabled: userId !== null,
    refetchInterval: LIVE,
    queryFn: async (): Promise<MySeat | null> => {
      const { data, error } = await client.rpc('my_seat');
      if (error) throw error;
      const row = data[0];
      return row === undefined ? null
        : { tableName: row.table_name, seat: row.seat, isAway: row.is_away, hasCallTime: row.has_call_time, callTimeLeft: row.call_time_left };
    },
  });
}
