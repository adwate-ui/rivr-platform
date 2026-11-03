import type { FloorTable, WaitlistBoardEntry } from '@rivr/db';
import { formatDuration, formatStakes, formatTime, t } from '@rivr/i18n';

/** What to know about a place after how long it has waited: why it is ahead, who added it, its call, that it is held. */
function notesOf(entry: WaitlistBoardEntry): string[] {
  const notes: string[] = [];
  if (entry.priorityReason !== null) notes.push(entry.priorityReason);
  if (entry.addedByFloor) notes.push(t('console.waitlist.card.addedByFloor'));
  if (entry.holdUntil !== null) {
    notes.push(t('console.waitlist.card.calledTo', { seat: entry.callSeat ?? 0, time: formatTime(new Date(entry.holdUntil)) }));
  }
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

/**
 * Whether a stake's name already says its blinds, as "NLH 50/100" or "NLH 1000/2000" does, written with the grouping
 * commas or without: then they show only once (UI polish audit A-10).
 */
export function nameGivesBlinds(name: string, smallBlind: bigint, bigBlind: bigint): boolean {
  const plain = (text: string) => text.replaceAll(',', '');
  return plain(name).includes(plain(formatStakes(smallBlind, bigBlind)));
}

/** A table's stake as its card names it: "NLH 100/200", the blinds once. */
export function stakeOf(table: FloorTable): string {
  const name = table.tableTypeName;
  return nameGivesBlinds(name, table.smallBlind, table.bigBlind) ? name : `${name} ${formatStakes(table.smallBlind, table.bigBlind)}`;
}

/** The line under a table's name on its card: "NLH 100/200 · 2 open", or that it is closed. */
export function tableMeta(table: FloorTable): string {
  if (!table.isOpen) return t('console.waitlist.card.closed', { stake: stakeOf(table) });
  return t('console.waitlist.card.meta', { stake: stakeOf(table), count: table.openSeats ?? table.seats });
}
