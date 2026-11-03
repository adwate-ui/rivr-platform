/** A table as Seat a player sees it: whether it is open, its free seats, and how many wait on its own list. */
export interface TableToSeat {
  readonly isOpen: boolean;
  readonly openSeats: number;
  readonly waiting: number;
}

/**
 * Where the Live floor's Seat a player seats (console v3, decision 0446): the first open table, in floor order, with a
 * free seat and someone on its list; else the first open table with a free seat, for a walk-up; null when every table is
 * closed or full.
 */
export function tableToSeatAt<Table extends TableToSeat>(tables: readonly Table[]): Table | null {
  const free = tables.filter((table) => table.isOpen && table.openSeats > 0);
  return free.find((table) => table.waiting > 0) ?? free[0] ?? null;
}
