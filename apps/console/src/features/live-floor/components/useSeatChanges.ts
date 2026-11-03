import type { SeatWho } from '@rivr/contracts';
import { useAddCallTime, useFloorActions, useFloorUndo, useSeatActions, type FloorTable, type SeatedPlayer } from '@rivr/db';
import { formatDuration, t } from '@rivr/i18n';
import { useRef } from 'react';
import { useChangeToast } from './useChangeToast.ts';

/** Who the Seat sheet seats: the next on the table's list, or a member found by mobile or membership number. */
export type Seating =
  | { readonly kind: 'list'; readonly entryId: string; readonly memberId: string; readonly fullName: string }
  | { readonly kind: 'number'; readonly who: SeatWho; readonly typed: string };

/** Where and for how long: the table, the seat and the call time in minutes. */
export interface SeatAt {
  readonly table: FloorTable;
  readonly seat: number;
  readonly callMinutes: number;
}

/** Seating, from a list or by number, each undone by taking the seat back (decision 0447). True when it went through. */
function useSeating(venueId: string) {
  const say = useChangeToast();
  const undo = useFloorUndo(venueId);
  const { seat, seatFromList } = useFloorActions(venueId);
  return async (who: Seating, at: SeatAt): Promise<boolean> => {
    const outcome = who.kind === 'list'
      ? await seatFromList.mutateAsync({ entryId: who.entryId, memberId: who.memberId, tableId: at.table.id, seat: at.seat, callMinutes: at.callMinutes })
      : await seat.mutateAsync({ tableId: at.table.id, seat: at.seat, who: who.who, callMinutes: at.callMinutes });
    const name = who.kind === 'list' ? who.fullName : who.typed;
    const sessionId = outcome.ok ? outcome.value : null;
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

/**
 * The floor's changes to who sits where: seat, move (undone by moving back), leave (undone by taking the seat again), add
 * time; and let go early with a reason, kept on the member's record and not undone (decision 0448).
 */
export function useSeatChanges(venueId: string) {
  const say = useChangeToast();
  const undo = useFloorUndo(venueId);
  const { move } = useFloorActions(venueId);
  const { leave, letLeaveEarly } = useSeatActions(venueId);
  return {
    seat: useSeating(venueId),
    addTime: useAddTime(venueId),
    move: async (player: SeatedPlayer, table: FloorTable, seat: number) => {
      const back = { sessionId: player.sessionId, tableId: player.tableId, seat: player.seat };
      say(await move.mutateAsync({ sessionId: player.sessionId, tableId: table.id, seat }),
        t('console.floor.toast.moved', { name: player.fullName, table: table.name, seat }), () => move.mutateAsync(back));
    },
    leave: async (player: { sessionId: string; fullName: string }, tableName: string) =>
      say(await leave.mutateAsync(player.sessionId), t('console.floor.toast.left', { name: player.fullName, table: tableName }),
        () => undo.mutateAsync({ kind: 'leave', sessionId: player.sessionId })),
    letGo: async (member: { memberId: string; fullName: string; sessionId?: string | undefined }, reason: string) => {
      const freesSeat = member.sessionId !== undefined;
      const letGo = await letLeaveEarly.mutateAsync({ memberId: member.memberId, reason, isSeatFreedNext: freesSeat });
      const outcome = letGo.ok && member.sessionId !== undefined ? await leave.mutateAsync(member.sessionId) : letGo;
      say(outcome, t('console.floor.toast.letGo', { name: member.fullName }));
    },
  };
}

export type SeatChanges = ReturnType<typeof useSeatChanges>;
