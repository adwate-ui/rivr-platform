/** The seat counts a table may have, fewest first: 2 to 10, as `game_table` checks (owner, 15 Nov). */
export const SEAT_COUNTS: readonly number[] = [2, 3, 4, 5, 6, 7, 8, 9, 10];

/** Whether a table may have this many seats. */
export function isSeatCount(seats: number): boolean {
  return SEAT_COUNTS.includes(seats);
}
