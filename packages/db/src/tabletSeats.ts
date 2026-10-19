import { err, ok, type Result } from '@rivr/contracts/result';
import type { Paise } from '@rivr/domain/money';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toPaise } from './parse/hands.ts';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/** Who sits in a seat: their session, name, whether away, and the buy-in already with the cage for them, if any. */
export interface TabletPlayer {
  readonly sessionId: string;
  readonly fullName: string;
  readonly isAway: boolean;
  readonly pendingBuyIn: Paise | null;
}

/** A seat at the tablet's table (#59): who sits there (null when open), and the table's minimum buy-in. */
export interface TabletSeat {
  readonly seat: number;
  readonly player: TabletPlayer | null;
  readonly minimum: Paise;
}

/** Why a seat event did not go through: not this tablet's table, the player gone, a buy-in already with the cage, the venue frozen, or anything else. */
export type SeatEventFailure = 'not_allowed' | 'invalid' | 'pending' | 'paused' | 'unavailable';

const FAILURE_BY_CODE: Readonly<Record<string, SeatEventFailure>> = {
  '42501': 'not_allowed', '22023': 'invalid', RVCHP: 'invalid', RVPND: 'pending', RVFRZ: 'paused',
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
      const { data, error } = await client.rpc('tablet_seats');
      if (error) throw error;
      return data.map((row) => ({
        seat: row.seat, minimum: toPaise(row.minimum_paise),
        player: row.session_id === null || row.full_name === null ? null : {
          sessionId: row.session_id, fullName: row.full_name, isAway: row.away_since !== null,
          pendingBuyIn: row.pending_buy_in_paise === null ? null : toPaise(row.pending_buy_in_paise),
        },
      }));
    },
  });
}

/**
 * The dealer's seat events (#59): `requestBuyIn` asks the cage for chips for a player (once per
 * request id), `setAway` marks them away or back, `leave` records that they left. Each is a Result.
 */
export function useSeatEvents() {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  const settle = async (error: { code: string } | null): Promise<Result<null, SeatEventFailure>> => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.tabletSeats(userId ?? 'signed-out') });
    return error ? err(FAILURE_BY_CODE[error.code] ?? 'unavailable') : ok(null);
  };
  const requestBuyIn = useMutation({
    mutationFn: async ({ sessionId, amount, requestId }: { sessionId: string; amount: Paise; requestId: string }) =>
      settle((await client.rpc('request_buy_in', { p_session_id: sessionId, p_amount_paise: Number(amount), p_idempotency_key: requestId })).error),
  });
  const setAway = useMutation({
    mutationFn: async ({ sessionId, isAway }: { sessionId: string; isAway: boolean }) =>
      settle((await client.rpc('set_seat_away', { p_session_id: sessionId, p_is_away: isAway })).error),
  });
  const leave = useMutation({
    mutationFn: async (sessionId: string) => settle((await client.rpc('end_seat', { p_session_id: sessionId, p_reason: 'left' })).error),
  });
  return { requestBuyIn, setAway, leave };
}
