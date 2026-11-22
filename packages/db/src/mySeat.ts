import { err, ok, type Result } from '@rivr/contracts/result';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';
import { LIST_MOST } from './limits.ts';
import { playedGame } from './parse/game.ts';

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
  /** The stake's game, `nlh` where it names none (`playedGame`); its figures: the blinds, and the straddle or null with none (issue 990). */
  readonly game: 'nlh' | 'plo';
  readonly smallBlind: bigint;
  readonly bigBlind: bigint;
  readonly straddle: bigint | null;
  /** When a call time was first set, by the member or the floor (#1059, #1076); null if never. */
  readonly callTimeSetAt: string | null;
  /**
   * The time a call time set or extended must fall after (the owner, 22 Nov): the end of the minimum playing time until
   * set, the current end once set, now once that has passed. Null with no call time, or while the member cannot see it.
   */
  readonly callTimeAfterAt: string | null;
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
      const { data, error } = await client.rpc('my_next_play_time_bonus').limit(LIST_MOST);
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
      const { data, error } = await client.rpc('my_seat').limit(LIST_MOST);
      if (error) throw error;
      const row = data[0];
      return row === undefined ? null
        : { tableName: row.table_name, seat: row.seat, isAway: row.is_away, hasCallTime: row.has_call_time, callTimeLeft: row.call_time_left,
            playedSeconds: row.played_seconds, isLeaving: row.is_leaving, topUp: isTopUp(row.top_up) ? row.top_up : null,
            callTimeMinutes: row.call_time_minutes, startedAt: row.started_at, callTimeEndsAt: row.call_time_ends_at,
            tableTypeName: row.table_type_name, game: playedGame(row.game), smallBlind: BigInt(row.small_blind_paise), bigBlind: BigInt(row.big_blind_paise),
            straddle: row.straddle_paise === null ? null : BigInt(row.straddle_paise),
            callTimeSetAt: row.call_time_set_at, callTimeAfterAt: row.call_time_after_at };
    },
  });
}

/** How leaving went: the seat open now (`left`), or the member on the floor's Leaving list until their call time is done (`leaving`). */
export type Leaving = 'left' | 'leaving';

/**
 * Why a seat action did not go through: not seated any more, the feature not open to them (a seat with no call time sets
 * none), a call time not after the minimum or the current end, or run past a day (#1059; the owner, 22 Nov), the account
 * or venue frozen, or anything else.
 */
export type MySeatFailure = 'not_seated' | 'not_allowed' | 'too_early' | 'too_long' | 'stopped' | 'paused' | 'unavailable';

const FAILURE_BY_CODE: Readonly<Record<string, MySeatFailure>> = {
  '22023': 'not_seated', '42501': 'not_allowed', RVCTN: 'not_allowed', RVCTE: 'too_early', RVCTX: 'too_long', RVMBR: 'stopped', RVFRZ: 'paused',
};

/**
 * The member's own seat actions (#634): set or extend their call time to a time (`setCallTime`, owed as well as the call
 * time they had, #1059; the owner, 22 Nov; the tap's request id sets it once), leave the seat (`leave`), and ask for a
 * top-up (`requestTopUp`). Each is a Result and reads the seat again.
 */
export function useMySeatActions() {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  const settle = async <T,>(error: { code: string } | null, value: T): Promise<Result<T, MySeatFailure>> => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.mySeat(userId ?? 'signed-out') });
    return error ? err(FAILURE_BY_CODE[error.code] ?? 'unavailable') : ok(value);
  };
  const setCallTime = useMutation({
    mutationFn: async ({ until, requestId }: { until: Date; requestId: string }) =>
      settle((await client.rpc('set_my_call_time', { p_until: until.toISOString(), p_idempotency_key: requestId })).error, null),
  });
  const leave = useMutation({
    mutationFn: async () => {
      const { data, error } = await client.rpc('leave_my_seat');
      return settle<Leaving>(error, data === 'left' ? 'left' : 'leaving');
    },
  });
  const requestTopUp = useMutation({ mutationFn: async () => settle((await client.rpc('request_top_up')).error, null) });
  return { setCallTime, leave, requestTopUp };
}

/** Where another player at the member's table stands with call time: not set, away (the clock stands still), done, or until `endsAt`. */
export type TablemateCallTime = { readonly kind: 'not_set' | 'away' | 'done' } | { readonly kind: 'until'; readonly endsAt: string };

/** Another player at the member's table (the owner, 22 Nov): their seat, first name (null for one who keeps it off the TVs) and call time. */
export interface Tablemate {
  readonly seat: number;
  readonly firstName: string | null;
  readonly callTime: TablemateCallTime;
}

function tablemateCallTime(state: string, endsAt: string | null): TablemateCallTime {
  if (state === 'until' && endsAt !== null) return { kind: 'until', endsAt };
  return { kind: state === 'away' || state === 'done' ? state : 'not_set' };
}

/** The others at the member's table, by seat, while they sit and see call time; none otherwise. Read with the seat. */
export function useMyTablemates(isEnabled: boolean) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.myTablemates(userId ?? 'signed-out'),
    enabled: userId !== null && isEnabled,
    refetchInterval: LIVE,
    queryFn: async (): Promise<Tablemate[]> => {
      const { data, error } = await client.rpc('my_tablemates').limit(LIST_MOST);
      if (error) throw error;
      return data.map((row) => ({ seat: row.seat, firstName: row.first_name, callTime: tablemateCallTime(row.call_time, row.ends_at) }));
    },
  });
}
