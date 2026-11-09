import type { FloorTable, WaitlistBoardEntry } from '@rivr/db';
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

/** A place's line under its name (console v3): how long they have waited, then what to know, "5 min · added by the floor". */
export function placeMeta(entry: WaitlistBoardEntry, now: Date): string {
  const waited = formatDuration((now.getTime() - new Date(entry.joinedAt).getTime()) / 1000);
  return [waited, ...notesOf(entry)].join(' · ');
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
