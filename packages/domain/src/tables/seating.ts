import { CALL_TIME_CHOICES } from '../callTime/callTime.ts';

/** A table as Seat a player sees it: whether it is open, its free seats, and how many wait on its own list. */
export interface TableToSeat {
  readonly isOpen: boolean;
  readonly openSeats: number;
  readonly waiting: number;
}

/**
 * Where the Live floor's Seat a player seats (console v3, decision 0479): the first open table, in floor order, with a
 * free seat and someone on its list; else the first open table with a free seat, for a walk-up; null when every table is
 * closed or full.
 */
export function tableToSeatAt<Table extends TableToSeat>(tables: readonly Table[]): Table | null {
  const free = tables.filter((table) => table.isOpen && table.openSeats > 0);
  return free.find((table) => table.waiting > 0) ?? free[0] ?? null;
}

/** A table as the floor weighs where else a listed player could sit. */
export interface TableWithRoom {
  readonly id: string;
  readonly tableTypeId: string;
  readonly isOpen: boolean;
  /** Seats free tonight; null counts as none. */
  readonly openSeats: number | null;
  /** Members on its own list, who have first claim on them (the owner, 9 Nov). */
  readonly waiting: number;
  /** The main table a must-move table feeds; null for a table of its own. */
  readonly mustMoveToTableId: string | null;
}

/** The seats at a table nobody on its own list has first claim to. */
const seatsToSpare = (table: TableWithRoom) => (table.openSeats ?? 0) - table.waiting;

/**
 * For a list at a table with no seat free: the open table at the same stake with the most seats to spare, or null (audit
 * F-036). Not one a must-move table feeds, as its next seat is the feeder's. A prompt for the floor, never a move: a list
 * is per table (the owner, 3 Nov).
 */
export function tableWithRoomFor<Table extends TableWithRoom>(own: Table, tables: readonly Table[]): Table | null {
  if (own.isOpen && (own.openSeats ?? 0) > 0) return null;
  const isFed = (table: Table) => tables.some((feeder) => feeder.isOpen && feeder.mustMoveToTableId === table.id);
  const others = tables.filter((table) => table.id !== own.id && table.tableTypeId === own.tableTypeId && table.isOpen && seatsToSpare(table) > 0 && !isFed(table));
  return others.reduce<Table | null>((best, table) => (best === null || seatsToSpare(table) > seatsToSpare(best) ? table : best), null);
}

/**
 * The call time the Seat sheet starts with at a table (decision 0299): the stake's own where it is one the floor picks
 * (3, 4 or 5 hours), else 3 hours; the floor may choose another.
 */
export function seatingCallTime(stakeMinutes: number): number {
  return CALL_TIME_CHOICES.find((minutes) => minutes === stakeMinutes) ?? CALL_TIME_CHOICES[0];
}
