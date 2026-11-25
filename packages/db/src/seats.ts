import { err, ok, type Result } from '@rivr/contracts/result';
import type { LeaveReason, SeatWho } from '@rivr/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRivrData } from './provider.tsx';
import type { TopUp } from './mySeat.ts';
import { queryKeys } from './queryKeys.ts';
import { LIST_MOST } from './limits.ts';

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
  /** When the floor marked the player leaving (decision 0163); null when not. */
  readonly leavingAt: string | null;
  /** Their top-up (#634): asked for, or in hand; null with none asked for. */
  readonly topUp: TopUp | null;
  /** When a call time was first set, by the member or the floor's Add call time (#1076); null if never. */
  readonly callTimeSetAt: string | null;
  /** When they leave, once a call time is set: from the server, null while away (the clock stands still) or never set. */
  readonly callTimeEndsAt: string | null;
  /** Whether they owe their call time: one is due until a call time has been set and has run out (#1076). */
  readonly owesCallTime: boolean;
  /**
   * The time a call time set or extended must fall after, by the member's own rule (the owner, 22 Nov): the end of the
   * minimum playing time until set, the current end once set, now once passed; null with no call time.
   */
  readonly callTimeAfterAt: string | null;
  /** Whether the member set or extended it last (the floor is told), not the floor's Add call time. */
  readonly isCallTimeSetByMember: boolean;
  /** The seat's latest call time change, so the floor is told of each once; null with none. */
  readonly callTimeChangeId: string | null;
}

/** A seat held for a member called from the waitlist (#63): nobody else is seated there. */
export interface HeldSeat {
  readonly tableId: string;
  readonly seat: number;
  readonly fullName: string;
  /** The waitlist place it is held for, which the floor seats there (decision 0302). */
  readonly entryId: string;
}

/**
 * Why a seating change did not go through: not the floor, the seat taken or held for a waitlist call,
 * the player already seated, no finished identity check, on a break, no member with that number, the
 * member or venue frozen, a table closed or a seat it does not have (`invalid`), no call time owed to let a player leave
 * early (`call_time_done`, #79), a table to close that still has players or held calls (`table_in_use`), a must-move
 * link to anything but an open main table of the same game (`must_move_invalid`), bonus chips redeemed with the seat
 * that are more than the member has, not whole 50s, on the staff member's own record, with promotions switched off, or
 * too many a minute (decision 0504), past what the visit may redeem (`visit_cap`, decision 0579), a seating whose Bonus was already redeemed with another
 * amount (`bonus_redeemed`, #1101), a call time the floor picks before the usual earliest or already gone, until confirmed
 * (`call_time_early`, `call_time_gone`, #1132), one past a day (`call_time_too_long`), or anything else (#333).
 */
export type SeatFailure = 'not_allowed' | 'occupied' | 'held' | 'seated' | 'kyc_needed' | 'on_break' | 'no_member' | 'stopped' | 'paused' | 'invalid'
  | 'call_time_done' | 'table_in_use' | 'must_move_invalid' | 'bonus_short' | 'not_chips' | 'own_record' | 'bonus_off' | 'too_many' | 'visit_cap' | 'bonus_redeemed'
  | 'call_time_early' | 'call_time_gone' | 'call_time_too_long' | 'unavailable';

/** The failure each database refusal of a seat change stands for; anything else is `unavailable`. */
export const SEAT_FAILURE_BY_CODE: Readonly<Record<string, SeatFailure>> = {
  '42501': 'not_allowed', RVOCC: 'occupied', RVHLD: 'held', RVSTD: 'seated', RVKYC: 'kyc_needed', RVBRK: 'on_break', RVNOM: 'no_member',
  RVMBR: 'stopped', RVFRZ: 'paused', '22023': 'invalid', RVCTD: 'call_time_done', RVBON: 'bonus_short', RVCHP: 'not_chips', RVOWN: 'own_record',
  RVKIL: 'bonus_off', RVRAT: 'too_many', RVVCP: 'visit_cap', RVBRD: 'bonus_redeemed', RVCTE: 'call_time_early', RVCTG: 'call_time_gone',
  RVCTX: 'call_time_too_long', RVCTN: 'invalid',
};

/** A seating's bonus chips argument (decision 0504): none when there are none to redeem. */
export function bonusArg(bonusChips: number | undefined): { p_bonus_chips?: number } {
  return bonusChips === undefined || bonusChips === 0 ? {} : { p_bonus_chips: bonusChips };
}

// The seat map changes as the floor seats, moves and calls players.
const LIVE = 10_000;

/**
 * The seats free at a table, in order: neither taken nor held for a waitlist call, from what the floor reads say (`taken`,
 * seated players and held seats, of any table). The move, the seat and the waitlist call each offer only these.
 */
export function openSeatsAt(table: { readonly id: string; readonly seats: number }, taken: readonly { readonly tableId: string; readonly seat: number }[]): number[] {
  const busy = new Set(taken.filter((one) => one.tableId === table.id).map((one) => one.seat));
  return Array.from({ length: table.seats }, (_, index) => index + 1).filter((number) => !busy.has(number));
}

/** The venue's seated players, table by table, for staff who read members; not asked while `isEnabled` is false. */
export function useFloorSeats(venueId: string, isEnabled = true) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.floorSeats(userId ?? 'signed-out', venueId),
    enabled: userId !== null && isEnabled,
    refetchInterval: LIVE,
    queryFn: async (): Promise<SeatedPlayer[]> => {
      const { data, error } = await client.rpc('floor_seats', { p_venue_id: venueId }).limit(LIST_MOST);
      if (error) throw error;
      return data.map((row) => ({
        sessionId: row.session_id, tableId: row.table_id, seat: row.seat, memberId: row.member_id, fullName: row.full_name,
        tierName: row.tier_name, startedAt: row.started_at, mustMoveOrder: row.must_move_order, isAway: row.away_since !== null,
        callTimeLeft: row.call_time_left, leavingAt: row.leaving_at,
        topUp: row.top_up === 'requested' || row.top_up === 'in_progress' ? row.top_up : null,
        callTimeSetAt: row.call_time_set_at, callTimeEndsAt: row.call_time_ends_at, owesCallTime: row.owes_call_time,
        callTimeAfterAt: row.call_time_after_at, isCallTimeSetByMember: row.call_time_set_by_member === true,
        callTimeChangeId: row.call_time_change_id,
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
      const { data, error } = await client.rpc('held_seats', { p_venue_id: venueId }).limit(LIST_MOST);
      if (error) throw error;
      return data.map((row) => ({ tableId: row.table_id, seat: row.seat, fullName: row.full_name, entryId: row.entry_id }));
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
      const { data, error } = await client.rpc('left_owing_call_time', { p_venue_id: venueId }).limit(LIST_MOST);
      if (error) throw error;
      return data.map((row) => ({ memberId: row.member_id, fullName: row.full_name, tableName: row.table_name, owed: row.owed_seconds }));
    },
  });
}

/** How a seat change ends: the floor is read again, and an error becomes its failure (or `unavailable`). */
function useSeatSettle(venueId: string) {
  const { userId } = useRivrData();
  const queryClient = useQueryClient();
  const user = userId ?? 'signed-out';
  return async (error: { code: string } | null, codes: Readonly<Record<string, SeatFailure>> = SEAT_FAILURE_BY_CODE): Promise<Result<null, SeatFailure>> => {
    // Tonight's top-ups too, so Top-ups moves on as soon as the floor starts or finishes one (decision 0299), and the rail's
    // counts, so a time request decided leaves its red count at once (decision 0305).
    const reread = [queryKeys.floorSeats(user, venueId), queryKeys.heldSeats(user, venueId), queryKeys.leftOwingCallTime(user, venueId), queryKeys.floorTables(user),
      queryKeys.topUpsTonight(user, venueId), queryKeys.topUpHistoryAll(user, venueId), queryKeys.staffQueueCounts(user, venueId), queryKeys.floorRequests(user, venueId)];
    await Promise.all(reread.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
    return error ? err(codes[error.code] ?? 'unavailable') : ok(null);
  };
}

/**
 * The floor's seating: `seat` a member by mobile or membership number, with the call time chosen (decision 0299), `leave`; floor managers `setOpen` a table (closing only an empty one) and
 * `setMustMove` (a table feeding a main table of its game, or null); admins `letLeaveEarly` a member who still owes call
 * time, with a reason (#79); the floor marks a player leaving, or takes it back (`setLeaving`, decision 0163), and away from
 * the table or back (`setAway`, #630: as the tablet does, so nothing needs it). Each is a Result and reloads the floor.
 */
export function useSeatActions(venueId: string) {
  const { client } = useRivrData();
  const settle = useSeatSettle(venueId);
  const seat = useMutation({
    mutationFn: async ({ tableId, seat: number, who, callMinutes }: { tableId: string; seat: number; who: SeatWho; callMinutes: number }) => {
      const found = 'phone' in who ? { p_phone: who.phone } : { p_member_number: who.memberNumber };
      return settle((await client.rpc('seat_member', { p_table_id: tableId, p_seat: number, ...found, p_call_minutes: callMinutes })).error);
    },
  });
  // Every leave says why (#1060).
  const leave = useMutation({
    mutationFn: async ({ sessionId, reason }: { sessionId: string; reason: LeaveReason }) =>
      settle((await client.rpc('end_seat', { p_session_id: sessionId, p_reason: 'left', p_leave_reason: reason })).error),
  });
  const setOpen = useMutation({
    mutationFn: async ({ tableId, isOpen }: { tableId: string; isOpen: boolean }) =>
      settle((await client.rpc('set_table_open', { p_table_id: tableId, p_is_open: isOpen })).error, { ...SEAT_FAILURE_BY_CODE, RVSTD: 'table_in_use' }),
  });
  const setMustMove = useMutation({
    mutationFn: async ({ tableId, mainTableId }: { tableId: string; mainTableId: string | null }) =>
      settle((await client.rpc('set_must_move', mainTableId === null ? { p_table_id: tableId } : { p_table_id: tableId, p_main_table_id: mainTableId })).error,
        { ...SEAT_FAILURE_BY_CODE, '22023': 'must_move_invalid' }),
  });
  const letLeaveEarly = useMutation({
    // A seated player's seat is freed next (`leave`), which reads the floor again: one re-read then serves both steps (#745).
    mutationFn: async ({ memberId, reason, isSeatFreedNext = false }: { memberId: string; reason: string; isSeatFreedNext?: boolean }) => {
      const { error } = await client.rpc('let_leave_early', { p_venue_id: venueId, p_member_id: memberId, p_reason: reason });
      return isSeatFreedNext && error === null ? ok(null) : settle(error);
    },
  });
  const setLeaving = useMutation({
    mutationFn: async ({ sessionId, isLeaving }: { sessionId: string; isLeaving: boolean }) =>
      settle((await client.rpc('set_leaving', { p_session_id: sessionId, p_is_leaving: isLeaving })).error),
  });
  return { seat, leave, setOpen, setMustMove, letLeaveEarly, setLeaving };
}

/** The floor sets a seated player's call time in minutes, 0 for none (#638). A Result, and the floor is read again. */
export function useSetSeatCallTime(venueId: string) {
  const { client } = useRivrData();
  const settle = useSeatSettle(venueId);
  return useMutation({
    mutationFn: async ({ sessionId, minutes }: { sessionId: string; minutes: number }) =>
      settle((await client.rpc('set_seat_call_time', { p_session_id: sessionId, p_minutes: minutes })).error),
  });
}

/**
 * The floor's managers (call_time.override) set or extend a seated player's call time to a time (decision 0305; the owner,
 * 22 Nov), which counts as setting it. A time before the usual earliest (after the minimum playing time until set, the
 * current end once set) is refused as `call_time_early`, and one gone as `call_time_gone`, until sent again `confirmed`
 * (the owner, 25 Nov; #1132). The same `requestId` again sets nothing more, so a retry after a lost answer is safe.
 */
export function useAddCallTime(venueId: string) {
  const { client } = useRivrData();
  const settle = useSeatSettle(venueId);
  return useMutation({
    mutationFn: async ({ sessionId, until, requestId, isConfirmed = false }: { sessionId: string; until: Date; requestId: string; isConfirmed?: boolean }) =>
      settle((await client.rpc('add_seat_call_time', {
        p_session_id: sessionId, p_until: until.toISOString(), p_idempotency_key: requestId, ...(isConfirmed ? { p_confirmed: true } : {}),
      })).error),
  });
}

/** The floor marks a member's own Set or Extend call time seen (#1090): it leaves Requests. A Result, and the floor is read again. */
export function useMarkCallTimeSeen(venueId: string) {
  const { client } = useRivrData();
  const settle = useSeatSettle(venueId);
  return useMutation({
    mutationFn: async (requestId: string) => settle((await client.rpc('mark_call_time_seen', { p_request_id: requestId })).error),
  });
}

/** The floor takes a seat's top-up in hand (`inProgress`), or resets it once done (#634). A Result, and the floor is read again. */
export function useSetTopUp(venueId: string) {
  const { client } = useRivrData();
  const settle = useSeatSettle(venueId);
  return useMutation({
    mutationFn: async ({ sessionId, inProgress }: { sessionId: string; inProgress: boolean }) =>
      settle((await client.rpc('set_top_up', { p_session_id: sessionId, p_in_progress: inProgress })).error),
  });
}
