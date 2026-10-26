/** A seat at a tournament table: tables and seats count from 1. */
export interface TournamentSeat {
  readonly table: number;
  readonly seat: number;
}

/** A move the floor is prompted to make: one player from the fullest table to the emptiest. */
export interface BalancingMove {
  readonly from: number;
  readonly to: number;
}

/** How many players sit at each table, tables 1 to `tables`. */
function countsByTable(occupied: readonly TournamentSeat[], tables: number): number[] {
  const counts = Array.from({ length: tables }, () => 0);
  for (const taken of occupied) {
    if (taken.table >= 1 && taken.table <= tables) counts[taken.table - 1] = (counts[taken.table - 1] ?? 0) + 1;
  }
  return counts;
}

/**
 * The seats a new player may be given (#120, decision 0204): every free seat at the tables with the fewest
 * players, in table then seat order. Seating picks one of them at random, so the field spreads evenly
 * and nobody chooses their table. None when every seat is taken: the player is an alternate. The
 * database's private.tournament_eligible_seats is proved equal on packages/testing/golden/tournamentSeating.json.
 */
export function eligibleSeats(occupied: readonly TournamentSeat[], tables: number, seatsPerTable: number): TournamentSeat[] {
  const counts = countsByTable(occupied, tables);
  const open = counts.map((count, index) => ({ table: index + 1, count })).filter((table) => table.count < seatsPerTable);
  const fewest = Math.min(...open.map((table) => table.count));
  const isTaken = (table: number, seat: number) => occupied.some((taken) => taken.table === table && taken.seat === seat);
  return open.filter((table) => table.count === fewest).flatMap((table) =>
    Array.from({ length: seatsPerTable }, (_, index) => ({ table: table.table, seat: index + 1 })).filter((place) => !isTaken(place.table, place.seat)));
}

/**
 * The moves that balance the tables (#120, decision 0204): while the fullest table has two or more
 * players than the emptiest, one player moves from the fullest to the emptiest (the lowest-numbered of
 * each on a tie). None when every table is within one of the others. The database's
 * private.tournament_balancing_moves is proved equal on the same golden file.
 */
export function balancingMoves(counts: readonly number[]): BalancingMove[] {
  const seated = [...counts];
  const moves: BalancingMove[] = [];
  for (;;) {
    const most = Math.max(...seated);
    const fewest = Math.min(...seated);
    if (seated.length === 0 || most - fewest <= 1) return moves;
    const from = seated.indexOf(most);
    const to = seated.indexOf(fewest);
    seated[from] = most - 1;
    seated[to] = fewest + 1;
    moves.push({ from: from + 1, to: to + 1 });
  }
}

/** The average stack: the chips bought, shared among the players still seated, in whole chips; none with nobody seated. */
export function averageStack(chipsInPlay: number, playersLeft: number): number {
  return playersLeft > 0 ? Math.floor(chipsInPlay / playersLeft) : 0;
}

/**
 * The place a run finished in (#120, decision 0204): of `runs` runs (entries and re-entries not refunded),
 * the bust ranked `bustRank` among the busts (the first 1) finishes `runs - bustRank + 1`, so the first out
 * of 58 is 58th and a later entry in late registration never shares a place. A rank outside the runs is a
 * bug and throws. The database's private.tournament_finish_place is proved equal on tournamentSeating.json.
 */
export function finishPlace(runs: number, bustRank: number): number {
  if (bustRank < 1 || bustRank > runs) throw new RangeError('A bust is one of the runs');
  return runs - bustRank + 1;
}
