import { err, ok, type Result } from '@rivr/contracts/result';
import type { SeatWho } from '@rivr/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { floorQueryKeys } from './floorRequests.ts';
import { useRivrData } from './provider.tsx';
import { bonusArg, SEAT_FAILURE_BY_CODE, type SeatFailure } from './seats.ts';

/** How a floor change ends: every read of the floor again, and an error as its failure (or `unavailable`). */
function useFloorSettle(venueId: string) {
  const { userId } = useRivrData();
  const queryClient = useQueryClient();
  return async (error: { code: string } | null): Promise<Result<null, SeatFailure>> => {
    await Promise.all(floorQueryKeys(userId ?? 'signed-out', venueId).map((queryKey) => queryClient.invalidateQueries({ queryKey })));
    return error ? err(SEAT_FAILURE_BY_CODE[error.code] ?? 'unavailable') : ok(null);
  };
}

/** A seating that went through gives its seat session, for Undo; null where it could not be found again. */
export type Seated = Result<string | null, SeatFailure>;

/** The member's seat session now, for a seating that gives none (Assign, a called place): read before the floor is. */
async function sessionOf(client: ReturnType<typeof useRivrData>['client'], venueId: string, memberId: string): Promise<string | null> {
  const seats = await client.rpc('floor_seats', { p_venue_id: venueId });
  return seats.data?.find((row) => row.member_id === memberId)?.session_id ?? null;
}

interface SeatByNumber {
  tableId: string;
  seat: number;
  who: SeatWho;
  callMinutes: number;
  /** Bonus chips the member redeems with their buy-in (decision 0504); none when left out or 0. */
  bonusChips?: number;
}

interface SeatFromList {
  entryId: string;
  memberId: string;
  tableId: string;
  seat: number;
  callMinutes: number;
  /** Bonus chips the member redeems with their buy-in (decision 0504); none when left out or 0. */
  bonusChips?: number;
}

/**
 * The Live floor's seating (console v3, decision 0479), each a Result that reads the floor again: `seat` a member by mobile
 * or membership number, or `seatFromList` the next on a table's list (Assign: called and seated at once, decision 0299),
 * each giving the new seat's session for Undo; `move` a seated player to an open seat at another table, or back;
 * `declineJoin` a join asked for from the app.
 */
export function useFloorActions(venueId: string) {
  const { client } = useRivrData();
  const settle = useFloorSettle(venueId);
  const seat = useMutation({
    mutationFn: async ({ tableId, seat: number, who, callMinutes, bonusChips }: SeatByNumber): Promise<Seated> => {
      const found = 'phone' in who ? { p_phone: who.phone } : { p_member_number: who.memberNumber };
      const { data, error } = await client.rpc('seat_member', {
        p_table_id: tableId, p_seat: number, ...found, p_call_minutes: callMinutes, ...bonusArg(bonusChips),
      });
      const settled = await settle(error);
      return settled.ok ? ok(data) : settled;
    },
  });
  const seatFromList = useMutation({
    mutationFn: async ({ entryId, memberId, tableId, seat: number, callMinutes, bonusChips }: SeatFromList): Promise<Seated> => {
      const { error } = await client.rpc('assign_from_waitlist', {
        p_entry_id: entryId, p_table_id: tableId, p_seat: number, p_call_minutes: callMinutes, ...bonusArg(bonusChips),
      });
      if (error) return settle(error);
      const session = await sessionOf(client, venueId, memberId);
      await settle(null);
      return ok(session);
    },
  });
  const move = useMutation({
    mutationFn: async ({ sessionId, tableId, seat: number }: { sessionId: string; tableId: string; seat: number }) =>
      settle((await client.rpc('move_seat', { p_session_id: sessionId, p_table_id: tableId, p_seat: number })).error),
  });
  // Declined by the floor, apart from a place its member gave up, so Undo brings back only the floor's own (decision 0480).
  const declineJoin = useMutation({
    mutationFn: async (entryId: string) => settle((await client.rpc('decline_waitlist_request', { p_entry_id: entryId })).error),
  });
  return { seat, seatFromList, move, declineJoin };
}

/**
 * A place called to a seat held for it, seated there (decision 0302): a Result with the seat's session for Undo, and the
 * floor read again.
 */
export function useSeatCalled(venueId: string) {
  const { client } = useRivrData();
  const settle = useFloorSettle(venueId);
  return useMutation({
    mutationFn: async ({ entryId, memberId }: { entryId: string; memberId: string }): Promise<Seated> => {
      const { error } = await client.rpc('seat_from_waitlist', { p_entry_id: entryId });
      if (error) return settle(error);
      const session = await sessionOf(client, venueId, memberId);
      await settle(null);
      return ok(session);
    },
  });
}

/**
 * What Undo takes back (decision 0480): a seat taken, a seat left, a call time decision or addition (`requestId`, or the
 * request id an addition was made with), a top-up step, or a join approved or declined.
 */
export type FloorUndo =
  | { readonly kind: 'seat' | 'leave'; readonly sessionId: string }
  | { readonly kind: 'callTime' | 'topUp'; readonly requestId: string }
  | { readonly kind: 'join'; readonly entryId: string };

/** The compensating function for one Undo. */
function undoCall(client: ReturnType<typeof useRivrData>['client'], undo: FloorUndo) {
  switch (undo.kind) {
    case 'seat': return client.rpc('undo_seat', { p_session_id: undo.sessionId });
    case 'leave': return client.rpc('undo_leave', { p_session_id: undo.sessionId });
    case 'callTime': return client.rpc('undo_call_time', { p_request_id: undo.requestId });
    case 'topUp': return client.rpc('undo_top_up', { p_request_id: undo.requestId });
    case 'join': return client.rpc('undo_waitlist_decision', { p_entry_id: undo.entryId });
  }
}

/**
 * Undo on the floor's toast (decision 0480): a compensating function in the database, never a rollback here. A Result: a
 * change that moved on since, or is two minutes old, is refused (`invalid`, `occupied`), and the floor is read again.
 */
export function useFloorUndo(venueId: string) {
  const { client } = useRivrData();
  const settle = useFloorSettle(venueId);
  return useMutation({ mutationFn: async (undo: FloorUndo) => settle((await undoCall(client, undo)).error) });
}
