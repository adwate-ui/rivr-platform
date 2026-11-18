import type { FloorTable, HeldSeat, SeatedPlayer } from '@rivr/db';
import { formatDuration, formatGameStakes, formatTime, t } from '@rivr/i18n';
import type { TileSeat } from '@rivr/ui';

/** A seated player who needs the floor: a top-up asked for or in hand, or leaving. */
export function needsFloor(player: SeatedPlayer): boolean {
  return player.topUp !== null || player.leavingAt !== null;
}

/** Each seat of a table in order: the player there, or none for an open seat (a held seat counts as taken). */
export function seatsAt(table: FloorTable, seats: readonly SeatedPlayer[]): (SeatedPlayer | undefined)[] {
  return Array.from({ length: table.seats }, (_, index) => seats.find((player) => player.tableId === table.id && player.seat === index + 1));
}

/** The tile's bar: open, seated, or in gold a player who needs the floor; a seat held for a call shows seated. */
export function tileSeats(table: FloorTable, seats: readonly SeatedPlayer[], held: readonly HeldSeat[]): TileSeat[] {
  return seatsAt(table, seats).map((player, index) => {
    if (player !== undefined) return needsFloor(player) ? 'needsYou' : 'seated';
    return held.some((seat) => seat.tableId === table.id && seat.seat === index + 1) ? 'seated' : 'open';
  });
}

/** What a player asks for, in gold on their row: a top-up, or leaving; none otherwise. */
export function requestFlag(player: SeatedPlayer): string | undefined {
  if (player.topUp !== null) return t(player.topUp === 'requested' ? 'console.floor.flagTopUp' : 'console.floor.flagToppingUp');
  return player.leavingAt === null ? undefined : t('console.floor.flagLeaving');
}

/**
 * A player's call time on their row (#1076): when they leave once a call time is set, what is left until then, Not set
 * once the countdown is done with none set (still owed), Call time done once met, or none given.
 */
export function callTimeMeta(player: SeatedPlayer): string {
  if (player.callTimeLeft === null) return t('console.floor.noCallTime');
  if (!player.owesCallTime) return t('console.floor.met');
  if (player.callTimeEndsAt !== null) return t('console.floor.leaves', { time: formatTime(new Date(player.callTimeEndsAt)) });
  return player.callTimeLeft > 0 ? formatDuration(player.callTimeLeft) : t('console.floor.notSet');
}

/** A table's stake as everyone writes it: `NLH 50/100`, `NLH 100/200/500` with a straddle. */
export const stakeOf = (table: FloorTable) => formatGameStakes(table.game, table.smallBlind, table.bigBlind, table.straddle);

/** A room, as the floor names it. */
export const roomName = (room: FloorTable['room']) => t(room === 'private' ? 'console.liveFloor.privateRoom' : 'console.liveFloor.mainRoom');
