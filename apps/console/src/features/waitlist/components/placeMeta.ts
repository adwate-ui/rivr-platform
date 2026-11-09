import type { FloorTable, WaitlistBoardEntry } from '@rivr/db';
import { isPlaceLate } from '@rivr/domain/floorRequests';
import { formatDuration, formatGameStakes, formatTime, t } from '@rivr/i18n';

/** What to know about a place after how long it has waited: its ID check, its call, why it is ahead, who added it, that it is held. */
function notesOf(entry: WaitlistBoardEntry): string[] {
  const notes: string[] = [];
  // First, as the floor must act on it before seating them (decision 0503).
  if (entry.needsIdCheck) notes.push(t('console.waitlist.card.idCheckNeeded'));
  // Then a call's deadline, which runs out (audit F-077).
  if (entry.holdUntil !== null) {
    notes.push(t('console.waitlist.card.calledTo', { seat: entry.callSeat ?? 0, time: formatTime(new Date(entry.holdUntil)) }));
  }
  if (entry.priorityReason !== null) notes.push(entry.priorityReason);
  if (entry.addedByFloor) notes.push(t('console.waitlist.card.addedByFloor'));
  // The called member said "I'm on my way" from the app (decision 0321).
  if (entry.onWayAt !== null) notes.push(t('console.waitlist.card.onTheWay'));
  if (entry.awayUntil !== null) notes.push(t('console.waitlist.card.placeHeld'));
  return notes;
}

/** How long a place has waited, in seconds. */
const waitedSeconds = (entry: WaitlistBoardEntry, now: Date) => (now.getTime() - new Date(entry.joinedAt).getTime()) / 1000;

/**
 * Whether a place waits past the list's target (audit F-075): not one called or held, whose hold runs its own clock, nor
 * one on a closed table's list, with no seat to be late for.
 */
export const isLatePlace = (entry: WaitlistBoardEntry, now: Date, isTableOpen = true) =>
  isTableOpen && entry.holdUntil === null && entry.awayUntil === null && isPlaceLate(waitedSeconds(entry, now));

/**
 * A place's line under its name (console v3): how long they have waited, then what to know, "5 min · added by the floor",
 * and where else the stake has room when the place's own table has none, "Table 4 has 6 open" (audit F-036).
 */
export function placeMeta(entry: WaitlistBoardEntry, now: Date, context: { isTableOpen: boolean; roomAt: FloorTable | null } = { isTableOpen: true, roomAt: null }): string {
  const age = formatDuration(waitedSeconds(entry, now));
  const waited = isLatePlace(entry, now, context.isTableOpen) ? t('console.waitlist.card.late', { age }) : age;
  // A place called has a seat held for it: nowhere else to point it.
  const room = context.roomAt === null || entry.holdUntil !== null ? [] : [t('console.waitlist.card.roomElsewhere', { table: context.roomAt.name, count: context.roomAt.openSeats ?? 0 })];
  return [waited, ...notesOf(entry), ...room].join(' · ');
}

/** A table's stake as everyone writes it: "NLH 100/200", "NLH 100/200/500" with a straddle (audit F-122). */
export function stakeOf(table: FloorTable): string {
  return formatGameStakes(table.game, table.smallBlind, table.bigBlind, table.straddle);
}

/** The line under a table's name on its card: "NLH 100/200 · 2 open", or that it is closed. */
export function tableMeta(table: FloorTable): string {
  if (!table.isOpen) return t('console.waitlist.card.closed', { stake: stakeOf(table) });
  return t('console.waitlist.card.meta', { stake: stakeOf(table), count: table.openSeats ?? table.seats });
}
