import { fromPaise, type Paise } from '../money/index.ts';

const SECONDS_PER_HOUR = 3_600n;
// A share in basis points (10,000 is all of it) of an amount in paise, as points at one a rupee (100 paise).
const BASIS_POINT_PAISE_PER_POINT = 10_000n * 100n;

function assertNotNegative(value: bigint, what: string): void {
  if (value < 0n) throw new RangeError(`${what} is never negative`);
}

/**
 * Hours by stake (#89; decision 0161): a table type's points an hour for the seconds played there, rounded
 * down to a whole point. A negative input is a bug and throws. The database's private.points_for_time is
 * proved equal on packages/testing/golden/points.json.
 */
export function pointsForTime(playedSeconds: bigint, pointsPerHour: bigint): bigint {
  assertNotNegative(playedSeconds, 'Time played');
  assertNotNegative(pointsPerHour, 'A rate of points');
  return (playedSeconds * pointsPerHour) / SECONDS_PER_HOUR;
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
 * One member's share of a hand's rake (RIVR Rewards): the rake split equally among the members seated at
 * the table when it was played, rounded down to the paisa. At least the member is seated.
 */
export function rakeShare(rake: Paise, seated: bigint): Paise {
  assertNotNegative(rake, 'Rake');
  if (seated < 1n) throw new RangeError('A share goes to at least one seated member');
  return fromPaise(rake / seated);
}

/**
 * RIVR Rewards: a share, in basis points (500 is 5%), of a member's rake for a visit, as points at one a
 * rupee, rounded down. Points never convert back to cash.
 */
export function rakePoints(share: Paise, rateBasisPoints: bigint): bigint {
  assertNotNegative(share, 'A rake share');
  if (rateBasisPoints < 0n || rateBasisPoints > 10_000n) throw new RangeError('A rate is 0 to 10,000 basis points');
  return (share * rateBasisPoints) / BASIS_POINT_PAISE_PER_POINT;
}
