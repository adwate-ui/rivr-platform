import type { LeaveReason, SeatWho } from '@rivr/contracts';
import { useAddCallTime, useCheckOutActions, useFloorActions, useFloorUndo, useSeatActions, type FloorTable, type SeatedPlayer } from '@rivr/db';
import { formatDuration, t } from '@rivr/i18n';
import { useRef } from 'react';
import { useChangeToast } from './useChangeToast.ts';

/** Who the Seat sheet seats: the next on the table's list, or a member found by mobile or membership number. */
export type Seating =
  | { readonly kind: 'list'; readonly entryId: string; readonly memberId: string; readonly fullName: string }
  | { readonly kind: 'number'; readonly who: SeatWho; readonly typed: string };

/** Where and for how long: the table, the seat and the call time in minutes; and bonus chips redeemed with the buy-in (decision 0504). */
export interface SeatAt {
  readonly table: FloorTable;
  readonly seat: number;
  readonly callMinutes: number;
  readonly bonusChips: number;
}

/**
 * Seating, from a list or by number, each undone by taking the seat back (decision 0480). A seat with bonus chips redeemed
 * has no Undo: the database keeps the redemption and refuses it. True when it went through.
 */
function useSeating(venueId: string) {
  const say = useChangeToast();
  const undo = useFloorUndo(venueId);
  const { seat, seatFromList } = useFloorActions(venueId);
  return async (who: Seating, at: SeatAt): Promise<boolean> => {
    const where = { tableId: at.table.id, seat: at.seat, callMinutes: at.callMinutes, bonusChips: at.bonusChips };
    const outcome = who.kind === 'list'
      ? await seatFromList.mutateAsync({ entryId: who.entryId, memberId: who.memberId, ...where })
      : await seat.mutateAsync({ who: who.who, ...where });
    const name = who.kind === 'list' ? who.fullName : who.typed;
    const sessionId = outcome.ok && at.bonusChips === 0 ? outcome.value : null;
    say(outcome, t('console.floor.toast.seated', { name, table: at.table.name, seat: at.seat }),
      sessionId === null ? undefined : () => undo.mutateAsync({ kind: 'seat', sessionId }));
    return outcome.ok;
  };
}

/**
 * More call time the floor's managers add (decision 0305), undone by its request id. Each length keeps its request id
 * until it goes through, so a press again after a lost answer adds it once.
 */
function useAddTime(venueId: string) {
  const say = useChangeToast();
  const undo = useFloorUndo(venueId);
  const add = useAddCallTime(venueId);
  const requestIds = useRef(new Map<string, string>());
  return async (player: SeatedPlayer, minutes: number) => {
    const key = `${player.sessionId}:${String(minutes)}`;
    const requestId = requestIds.current.get(key) ?? crypto.randomUUID();
    requestIds.current.set(key, requestId);
    const outcome = await add.mutateAsync({ sessionId: player.sessionId, minutes, requestId });
    if (outcome.ok) requestIds.current.delete(key);
    say(outcome, t('console.floor.toast.timeAdded', { name: player.fullName, time: formatDuration(minutes * 60) }),
      () => undo.mutateAsync({ kind: 'callTime', requestId }));
  };
}

/** Who leaves and is checked out of the club too. */
interface CheckingOut {
  readonly memberId: string;
  readonly fullName: string;
}

/**
 * The floor's changes to who sits where: seat, move (undone by moving back), leave (undone by taking the seat again), add
 * time; and let go early with a reason, kept on the member's record and not undone (decision 0481). Leave and let go early
 * can also check the player out of the club (owner, 16 Nov): no Undo then, and a check-out refused leaves the seat change
 * standing and says to check them out at the door.
 */
export function useSeatChanges(venueId: string) {
  const say = useChangeToast();
  const undo = useFloorUndo(venueId);
  const { move } = useFloorActions(venueId);
  const { leave, letLeaveEarly } = useSeatActions(venueId);
  const { checkOut } = useCheckOutActions(venueId);
  /** Checks the member out once their seat is done: true when they are out, one already out of the club included. */
  const isCheckedOut = async (member: CheckingOut) => {
    const out = await checkOut.mutateAsync(member.memberId);
    return out.ok || out.error.reason === 'not_in_room';
  };
  const notOut = (member: CheckingOut) => t('console.floor.toast.notCheckedOut', { name: member.fullName });
  return {
    seat: useSeating(venueId),
    addTime: useAddTime(venueId),
    move: async (player: SeatedPlayer, table: FloorTable, seat: number) => {
      const back = { sessionId: player.sessionId, tableId: player.tableId, seat: player.seat };
      say(await move.mutateAsync({ sessionId: player.sessionId, tableId: table.id, seat }),
        t('console.floor.toast.moved', { name: player.fullName, table: table.name, seat }), () => move.mutateAsync(back));
    },
    leave: async (player: { sessionId: string; fullName: string }, tableName: string, reason: LeaveReason) =>
      say(await leave.mutateAsync({ sessionId: player.sessionId, reason }), t('console.floor.toast.left', { name: player.fullName, table: tableName }),
        () => undo.mutateAsync({ kind: 'leave', sessionId: player.sessionId })),
    leaveAndCheckOut: async (player: CheckingOut & { sessionId: string }, tableName: string, reason: LeaveReason) => {
      const left = await leave.mutateAsync({ sessionId: player.sessionId, reason });
      const done = t('console.floor.toast.leftOut', { name: player.fullName, table: tableName });
      if (!left.ok || await isCheckedOut(player)) return say(left, done);
      // Out of the seat but still in the club: the leave alone went through, and Undo takes the seat back as it would.
      return say(left, notOut(player), () => undo.mutateAsync({ kind: 'leave', sessionId: player.sessionId }));
    },
    letGo: async (member: CheckingOut & { sessionId?: string | undefined }, reason: LeaveReason, isCheckingOut = false) => {
      const freesSeat = member.sessionId !== undefined;
      // The early departure keeps the reason in words, as the member's record shows it.
      const letGo = await letLeaveEarly.mutateAsync({ memberId: member.memberId, reason: t(`common.leaveReasons.${reason}`), isSeatFreedNext: freesSeat });
      const outcome = letGo.ok && member.sessionId !== undefined ? await leave.mutateAsync({ sessionId: member.sessionId, reason }) : letGo;
      if (!isCheckingOut || !outcome.ok) return say(outcome, t('console.floor.toast.letGo', { name: member.fullName }));
      return say(outcome, await isCheckedOut(member) ? t('console.floor.toast.letGoOut', { name: member.fullName }) : notOut(member));
    },
  };
}

export type SeatChanges = ReturnType<typeof useSeatChanges>;
