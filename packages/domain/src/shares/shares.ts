import { fromPaise, type Paise } from '../money/index.ts';

function assertNotNegative(value: bigint, what: string): void {
  if (value < 0n) throw new RangeError(`${what} is never negative`);
}

/**
 * The time played at one table of a session that moved: the session's played time (seating to leaving,
 * less time away) shared among its tables in proportion to the time at each, rounded down to the second.
 * Time away is not known by table, so each table bears its share of it.
 */
export function tablePlayedSeconds(tableSeconds: bigint, sessionSeconds: bigint, playedSeconds: bigint): bigint {
  assertNotNegative(tableSeconds, 'Time at a table');
  if (tableSeconds > sessionSeconds) throw new RangeError('A table holds no more than the whole session');
  if (playedSeconds < 0n || playedSeconds > sessionSeconds) throw new RangeError('Time played is within the session');
  if (sessionSeconds === 0n) return 0n;
  return (tableSeconds * playedSeconds) / sessionSeconds;
}

/**
 * One member's share of a hand's rake (rakeback): the rake split equally among the members seated at
 * the table when it was played, rounded down to the paisa. At least the member is seated.
 */
export function rakeShare(rake: Paise, seated: bigint): Paise {
  assertNotNegative(rake, 'Rake');
  if (seated < 1n) throw new RangeError('A share goes to at least one seated member');
  return fromPaise(rake / seated);
}
