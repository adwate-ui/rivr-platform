import { err, ok, type Result } from '@rivr/contracts/result';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/** A seat's top-up (#634): asked for, then in hand at the floor; null with none asked for. */
export type TopUp = 'requested' | 'in_progress';

/**
 * The signed-in member's seat tonight (#78): where, whether away, whether the seat has call time, and
 * the time left (null without call_time.view or call time); how long they have played, whether they are
 * on the floor's Leaving list, and their top-up (#634).
 */
export interface MySeat {
  readonly tableName: string;
  readonly seat: number;
  readonly isAway: boolean;
  readonly hasCallTime: boolean;
  readonly callTimeLeft: number | null;
  readonly playedSeconds: number;
  readonly isLeaving: boolean;
  readonly topUp: TopUp | null;
}

// The time left is read again each half minute; Home shows it to the minute.
const LIVE = 30_000;

const isTopUp = (value: string | null): value is TopUp => value === 'requested' || value === 'in_progress';

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
        : { tableName: row.table_name, seat: row.seat, isAway: row.is_away, hasCallTime: row.has_call_time, callTimeLeft: row.call_time_left,
            playedSeconds: row.played_seconds, isLeaving: row.is_leaving, topUp: isTopUp(row.top_up) ? row.top_up : null };
    },
  });
}

/** How leaving went: the seat open now (`left`), or the member on the floor's Leaving list until their call time is done (`leaving`). */
export type Leaving = 'left' | 'leaving';

/** Why a seat action did not go through: not seated any more, the feature not open to them, the account or venue frozen, or anything else. */
export type MySeatFailure = 'not_seated' | 'not_allowed' | 'stopped' | 'paused' | 'unavailable';

const FAILURE_BY_CODE: Readonly<Record<string, MySeatFailure>> = {
  '22023': 'not_seated', '42501': 'not_allowed', RVMBR: 'stopped', RVFRZ: 'paused',
};

/**
 * The member's own seat actions (#634): an hour more call time (`extend`), leave the seat (`leave`), and
 * ask the floor for a top-up (`requestTopUp`). Each is a Result and reads the seat again.
 */
export function useMySeatActions() {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  const settle = async <T,>(error: { code: string } | null, value: T): Promise<Result<T, MySeatFailure>> => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.mySeat(userId ?? 'signed-out') });
    return error ? err(FAILURE_BY_CODE[error.code] ?? 'unavailable') : ok(value);
  };
  const extend = useMutation({ mutationFn: async () => settle((await client.rpc('extend_my_call_time')).error, null) });
  const leave = useMutation({
    mutationFn: async () => {
      const { data, error } = await client.rpc('leave_my_seat');
      return settle<Leaving>(error, data === 'left' ? 'left' : 'leaving');
    },
  });
  const requestTopUp = useMutation({ mutationFn: async () => settle((await client.rpc('request_top_up')).error, null) });
  return { extend, leave, requestTopUp };
}
