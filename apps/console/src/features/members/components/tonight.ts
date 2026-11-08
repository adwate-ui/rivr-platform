import type { FloorTable, SeatedPlayer, TodaysPlayer } from '@rivr/db';

/** Where a member is tonight: in a seat, waiting for one, in the room without either, or gone home. A member not at the club today has none. */
export type Tonight =
  | { readonly kind: 'seated'; readonly tableId: string; readonly tableName: string; readonly seat: number }
  | { readonly kind: 'waiting' }
  | { readonly kind: 'in_room' }
  | { readonly kind: 'left' };

/**
 * Each member at the club tonight, by member id. The floor's seats say where a player sits; the day's list says who is
 * waiting or has left. A player it calls playing shows once the floor's seats are read.
 */
export function tonightByMember(
  seats: readonly Pick<SeatedPlayer, 'memberId' | 'tableId' | 'seat'>[],
  tables: readonly Pick<FloorTable, 'id' | 'name'>[],
  today: readonly Pick<TodaysPlayer, 'memberId' | 'status'>[],
): ReadonlyMap<string, Tonight> {
  const names = new Map(tables.map((table) => [table.id, table.name]));
  const byMember = new Map<string, Tonight>();
  for (const player of today) {
    // Someone who never checked in was not here tonight.
    if (player.status === 'waiting' || player.status === 'in_room' || player.status === 'left') byMember.set(player.memberId, { kind: player.status });
  }
  for (const seated of seats) {
    byMember.set(seated.memberId, { kind: 'seated', tableId: seated.tableId, tableName: names.get(seated.tableId) ?? '', seat: seated.seat });
  }
  return byMember;
}

/** The live floor with a seat chosen (console v3): where a member record's Show goes. */
export function floorSeatHref(tableId: string, seat: number): string {
  return `/?table=${encodeURIComponent(tableId)}&seat=${String(seat)}`;
}
