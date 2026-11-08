import { err, ok, type Result } from '@rivr/contracts/result';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/** A seat's top-up (#634): asked for, then in hand at the floor; null with none asked for. */
export type TopUp = 'requested' | 'in_progress';

/**
 * The signed-in member's seat tonight (#78): where, whether away, whether the seat has call time, and
 * the time left (null without call_time.view or call time); how long they have played, whether they are
 * on the floor's Leaving list, and their top-up (#634); the call time the floor gave, their minimum session, in minutes
 * (null without call_time.view; decision 0300).
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
  readonly callTimeMinutes: number | null;
  /** When the member sat down, for "Playing since" (decision 0300). */
  readonly startedAt: string;
  /**
   * When the call time ends, from the server, so the ring counts down from the phone's clock and never from data gone
   * stale (decision 0320); null while away (the clock stands still) or without call time.
   */
  readonly callTimeEndsAt: string | null;
  /** The seat's game and stakes: "NLH 50/100". */
  readonly tableTypeName: string;
  readonly smallBlind: bigint;
  readonly bigBlind: bigint;
  /** More call time asked for, waiting on the floor (decision 0320), in minutes; null with none. */
  readonly timeRequestMinutes: number | null;
  /** The lengths of more call time the club offers, in minutes, shortest first (decision 0305). */
  readonly addTimeChoices: readonly number[];
}

// The time left is read again each half minute; Home shows it to the minute.
const LIVE = 30_000;

const isTopUp = (value: string | null): value is TopUp => value === 'requested' || value === 'in_progress';

/** The next play-time bonus step this seat is counting towards (audit F-173). */
export interface NextPlayTimeBonus {
  readonly chips: number;
  readonly afterMinutes: number;
  readonly secondsLeft: number;
}

/** The next play-time bonus that would pay on the member's seat, or null when none is counting. */
export function useMyNextPlayTimeBonus() {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.myNextPlayTimeBonus(userId ?? 'signed-out'),
    enabled: userId !== null,
    refetchInterval: LIVE,
    queryFn: async (): Promise<NextPlayTimeBonus | null> => {
      const { data, error } = await client.rpc('my_next_play_time_bonus');
      if (error) throw error;
      const row = data[0];
      return row === undefined ? null : { chips: Number(row.chips), afterMinutes: row.after_minutes, secondsLeft: Number(row.seconds_left) };
    },
  });
}

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
            playedSeconds: row.played_seconds, isLeaving: row.is_leaving, topUp: isTopUp(row.top_up) ? row.top_up : null,
            callTimeMinutes: row.call_time_minutes, startedAt: row.started_at, callTimeEndsAt: row.call_time_ends_at,
            tableTypeName: row.table_type_name, smallBlind: BigInt(row.small_blind_paise), bigBlind: BigInt(row.big_blind_paise),
            timeRequestMinutes: row.time_request_minutes, addTimeChoices: row.add_time_choices };
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
 * The member's own seat actions (#634): ask the floor for more call time (`requestTime`, 30, 60 or 120 minutes, decision
 * 0320; the tap's request id asks once), leave the seat (`leave`), and ask for a top-up (`requestTopUp`). Each is a Result
 * and reads the seat again.
 */
export function useMySeatActions() {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  const settle = async <T,>(error: { code: string } | null, value: T): Promise<Result<T, MySeatFailure>> => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.mySeat(userId ?? 'signed-out') });
    return error ? err(FAILURE_BY_CODE[error.code] ?? 'unavailable') : ok(value);
  };
  const requestTime = useMutation({
    mutationFn: async ({ minutes, requestId }: { minutes: number; requestId: string }) =>
      settle((await client.rpc('request_call_time', { p_minutes: minutes, p_idempotency_key: requestId })).error, null),
  });
  const leave = useMutation({
    mutationFn: async () => {
      const { data, error } = await client.rpc('leave_my_seat');
      return settle<Leaving>(error, data === 'left' ? 'left' : 'leaving');
    },
  });
  const requestTopUp = useMutation({ mutationFn: async () => settle((await client.rpc('request_top_up')).error, null) });
  return { requestTime, leave, requestTopUp };
}
