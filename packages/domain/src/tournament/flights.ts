/**
 * A run of a Day 1 flight once the flight is bagged (#117; decision 0251): bagged with its chips, or out in its
 * place among the flight's runs.
 */
export type FlightRun =
  | { readonly player: string; readonly chips: bigint }
  | { readonly player: string; readonly place: number; readonly flightRuns: number };

/** Day 2's field, as indexes into the runs: the runs that go through, in the order of the runs, and the players out on Day 1, best first. */
export interface DayTwoField {
  readonly through: readonly number[];
  readonly out: readonly number[];
}

function isWhole(run: FlightRun): boolean {
  if (run.player === '') return false;
  if ('chips' in run) return run.chips > 0n;
  return Number.isInteger(run.place) && Number.isInteger(run.flightRuns) && run.place >= 1 && run.place <= run.flightRuns;
}

/** How many players a run that was out outlasted in its flight. */
const outlasted = (run: FlightRun) => ('chips' in run ? 0 : run.flightRuns - run.place);

/** Whether a later run of a player places them better than an earlier one: a bag beats a run out; the bigger bag; the run out that outlasted more players, then the one in the smaller flight. */
function isBetter(later: FlightRun, earlier: FlightRun): boolean {
  if ('chips' in later) return !('chips' in earlier) || later.chips > earlier.chips;
  if ('chips' in earlier) return false;
  return outlasted(later) > outlasted(earlier) || (outlasted(later) === outlasted(earlier) && later.flightRuns < earlier.flightRuns);
}

/**
 * Who plays Day 2 of a multi-flight event (#117; decision 0251, question #489): every player left when their
 * flight was bagged goes through, and one who went through in two flights keeps the bigger stack (the earlier run
 * on a tie). Every other player is placed below Day 2's field by their best run: the one that outlasted the most
 * players in its flight, then the one in the smaller flight, then the earlier. Runs come in the order they were
 * made. A bag of no chips, a place outside its flight, or a run with no player is a bug and throws. The database's
 * private.tournament_day_two_field is proved equal on tournamentSeating.json.
 */
export function dayTwoField(runs: readonly FlightRun[]): DayTwoField {
  if (!runs.every(isWhole)) throw new RangeError('Each run a player\'s, bagged with chips above nothing or out in a place of its flight');
  const best = new Map<string, number>();
  runs.forEach((run, index) => {
    const held = best.get(run.player);
    const heldRun = held === undefined ? undefined : runs[held];
    if (heldRun === undefined || isBetter(run, heldRun)) best.set(run.player, index);
  });
  const chosen = [...best.values()].sort((a, b) => a - b);
  const runAt = (index: number): FlightRun => {
    const found = runs[index];
    if (found === undefined) throw new RangeError('A run of the list');
    return found;
  };
  const isBag = (index: number) => 'chips' in runAt(index);
  const out = chosen.filter((index) => !isBag(index)).sort((a, b) => {
    const one = runAt(a);
    const other = runAt(b);
    const flightRuns = (run: FlightRun) => ('chips' in run ? 0 : run.flightRuns);
    return outlasted(other) - outlasted(one) || flightRuns(one) - flightRuns(other) || a - b;
  });
  return { through: chosen.filter(isBag), out };
}
