import { err, ok, type Result } from '@rivr/contracts/result';
import type { Paise } from '@rivr/domain/money';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toPaise } from './parse/hands.ts';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';
import { LIST_MOST } from './limits.ts';

/** Who sits in a seat: their session, name and whether away. */
export interface TabletPlayer {
  readonly sessionId: string;
  readonly fullName: string;
  readonly isAway: boolean;
  /** They have said they are leaving, or the floor has (F-189). */
  readonly isLeaving: boolean;
  /** Whole seconds of call time left (#78); null where the table's type has none. */
  readonly callTimeLeft: number | null;
}

/** A seat at the tablet's table (#59): who sits there (null when open), and the table's minimum buy-in and blinds. */
export interface TabletSeat {
  readonly seat: number;
  readonly player: TabletPlayer | null;
  readonly minimum: Paise;
  readonly smallBlind: Paise;
  readonly bigBlind: Paise;
  /** The stake's straddle; null with none. */
  readonly straddle: Paise | null;
}

/** Why a seat event did not go through: not this tablet's table, the player gone, the venue frozen, or anything else. */
export type SeatEventFailure = 'not_allowed' | 'invalid' | 'paused' | 'unavailable';

const FAILURE_BY_CODE: Readonly<Record<string, SeatEventFailure>> = {
  '42501': 'not_allowed', '22023': 'invalid', RVCHP: 'invalid', RVFRZ: 'paused',
};

// A player seated by the floor appears on the tablet within seconds.
const LIVE = 10_000;

/** Every seat at the tablet's table, and who sits in it. */
export function useTabletSeats() {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.tabletSeats(userId ?? 'signed-out'),
    enabled: userId !== null,
    refetchInterval: LIVE,
    queryFn: async (): Promise<TabletSeat[]> => {
      const { data, error } = await client.rpc('tablet_seats').limit(LIST_MOST);
      if (error) throw error;
      return data.map((row) => ({
        seat: row.seat, minimum: toPaise(row.minimum_paise), smallBlind: toPaise(row.small_blind_paise), bigBlind: toPaise(row.big_blind_paise),
        straddle: row.straddle_paise === null ? null : toPaise(row.straddle_paise),
        player: row.session_id === null || row.full_name === null ? null : {
          sessionId: row.session_id, fullName: row.full_name, isAway: row.away_since !== null, isLeaving: row.leaving_at !== null,
          callTimeLeft: row.call_time_left,
        },
      }));
    },
  });
}

/**
 * The dealer's seat events (#59): `setAway` marks a player away or back, `leave` records that they left. Each is a Result, sent whether the
 * browser says it is online or not: offline it fails at once, and never goes later, when the player may be back or gone.
 */
export function useSeatEvents() {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  const settle = async (error: { code: string } | null): Promise<Result<null, SeatEventFailure>> => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.tabletSeats(userId ?? 'signed-out') });
    return error ? err(FAILURE_BY_CODE[error.code] ?? 'unavailable') : ok(null);
  };
  const setAway = useMutation({
    networkMode: 'always',
    mutationFn: async ({ sessionId, isAway }: { sessionId: string; isAway: boolean }) =>
      settle((await client.rpc('set_seat_away', { p_session_id: sessionId, p_is_away: isAway })).error),
  });
  const leave = useMutation({
    networkMode: 'always',
    mutationFn: async (sessionId: string) => settle((await client.rpc('end_seat', { p_session_id: sessionId, p_reason: 'left' })).error),
  });
  return { setAway, leave };
}
