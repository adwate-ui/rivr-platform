import { err, ok, type Result } from '@rivr/contracts/result';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/** Who sits where (#77): a seated player's session, table and seat, since when they play, and their must-move turn. */
export interface SeatedPlayer {
  readonly sessionId: string;
  readonly tableId: string;
  readonly seat: number;
  readonly memberId: string;
  readonly fullName: string;
  readonly tierName: string;
  /** When play began: call time (#78) runs from here, across moves. */
  readonly startedAt: string;
  /** At a must-move table, the order its players move up in (1 first); null elsewhere. */
  readonly mustMoveOrder: number | null;
  /** Away from the table, the seat kept (#59). */
  readonly isAway: boolean;
  /** Whole seconds of call time left (#78); null where the table's type has none. */
  readonly callTimeLeft: number | null;
}

/** A seat held for a member called from the waitlist (#63): nobody else is seated there. */
export interface HeldSeat {
  readonly tableId: string;
  readonly seat: number;
  readonly fullName: string;
}

/**
 * Why a seating change did not go through: not the floor, the seat taken or held for a waitlist call,
 * the player already seated, no finished identity check, on a break, no member with that number, the
 * member or venue frozen, a table closed or a seat it does not have (`invalid`), no call time owed to let a player leave
 * early (`call_time_done`, #79), or anything else.
 */
export type SeatFailure = 'not_allowed' | 'occupied' | 'held' | 'seated' | 'kyc_needed' | 'on_break' | 'no_member' | 'stopped' | 'paused' | 'invalid'
  | 'call_time_done' | 'unavailable';

const FAILURE_BY_CODE: Readonly<Record<string, SeatFailure>> = {
  '42501': 'not_allowed', RVOCC: 'occupied', RVHLD: 'held', RVSTD: 'seated', RVKYC: 'kyc_needed', RVBRK: 'on_break', RVNOM: 'no_member',
  RVMBR: 'stopped', RVFRZ: 'paused', '22023': 'invalid', RVCTD: 'call_time_done',
};

// The seat map changes as the floor seats, moves and calls players.
const LIVE = 10_000;

/** The venue's seated players, table by table, for staff who read members. */
export function useFloorSeats(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.floorSeats(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    refetchInterval: LIVE,
    queryFn: async (): Promise<SeatedPlayer[]> => {
      const { data, error } = await client.rpc('floor_seats', { p_venue_id: venueId });
      if (error) throw error;
      return data.map((row) => ({
        sessionId: row.session_id, tableId: row.table_id, seat: row.seat, memberId: row.member_id, fullName: row.full_name,
        tierName: row.tier_name, startedAt: row.started_at, mustMoveOrder: row.must_move_order, isAway: row.away_since !== null,
        callTimeLeft: row.call_time_left,
      }));
    },
  });
}

/** The venue's seats held for waitlist calls, for staff who read members. */
export function useHeldSeats(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.heldSeats(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    refetchInterval: LIVE,
    queryFn: async (): Promise<HeldSeat[]> => {
      const { data, error } = await client.rpc('held_seats', { p_venue_id: venueId });
      if (error) throw error;
      return data.map((row) => ({ tableId: row.table_id, seat: row.seat, fullName: row.full_name }));
    },
  });
}

/** A member in the room who left their seat before its call time, with no early departure yet (#79). */
export interface LeftOwing {
  readonly memberId: string;
  readonly fullName: string;
  readonly tableName: string;
  /** Whole seconds of call time still owed on that seat. */
  readonly owed: number;
}

/** Members who left a seat before its call time and have not been let go early, for admins (`call_time.override`) on the Live floor. */
export function useLeftOwingCallTime(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.leftOwingCallTime(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    refetchInterval: LIVE,
    queryFn: async (): Promise<LeftOwing[]> => {
      const { data, error } = await client.rpc('left_owing_call_time', { p_venue_id: venueId });
      if (error) throw error;
      return data.map((row) => ({ memberId: row.member_id, fullName: row.full_name, tableName: row.table_name, owed: row.owed_seconds }));
    },
  });
}

/**
 * The floor's seating: `seat` a member by mobile number, `move` a player (the same session, so call
 * time runs on), `leave`; floor managers `setOpen` a table (closing only an empty one) and
 * `setMustMove` (a table feeding a main table of its game, or null); admins `letLeaveEarly` a member who still owes call
 * time, with a reason (#79). Each is a Result and reloads the floor.
 */
export function useSeatActions(venueId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  const settle = async (error: { code: string } | null): Promise<Result<null, SeatFailure>> => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.floorSeats(userId ?? 'signed-out', venueId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.heldSeats(userId ?? 'signed-out', venueId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.leftOwingCallTime(userId ?? 'signed-out', venueId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.floorTables(userId ?? 'signed-out') }),
    ]);
    return error ? err(FAILURE_BY_CODE[error.code] ?? 'unavailable') : ok(null);
  };
  const seat = useMutation({
    mutationFn: async ({ tableId, seat: number, phone }: { tableId: string; seat: number; phone: string }) =>
      settle((await client.rpc('seat_member', { p_table_id: tableId, p_seat: number, p_phone: phone })).error),
  });
  const move = useMutation({
    mutationFn: async ({ sessionId, tableId, seat: number }: { sessionId: string; tableId: string; seat: number }) =>
      settle((await client.rpc('move_seat', { p_session_id: sessionId, p_table_id: tableId, p_seat: number })).error),
  });
  const leave = useMutation({
    mutationFn: async (sessionId: string) => settle((await client.rpc('end_seat', { p_session_id: sessionId, p_reason: 'left' })).error),
  });
  const setOpen = useMutation({
    mutationFn: async ({ tableId, isOpen }: { tableId: string; isOpen: boolean }) =>
      settle((await client.rpc('set_table_open', { p_table_id: tableId, p_is_open: isOpen })).error),
  });
  const setMustMove = useMutation({
    mutationFn: async ({ tableId, mainTableId }: { tableId: string; mainTableId: string | null }) =>
      settle((await client.rpc('set_must_move', mainTableId === null ? { p_table_id: tableId } : { p_table_id: tableId, p_main_table_id: mainTableId })).error),
  });
  const letLeaveEarly = useMutation({
    mutationFn: async ({ memberId, reason }: { memberId: string; reason: string }) =>
      settle((await client.rpc('let_leave_early', { p_venue_id: venueId, p_member_id: memberId, p_reason: reason })).error),
  });
  return { seat, move, leave, setOpen, setMustMove, letLeaveEarly };
}
