/**
 * What a tournament finish earns in the RIVR League (#147; decision 0182), from the venue's league.points:
 * every finisher's points for taking part, and more for first, second, third or the rest of the final
 * table (fourth to ninth).
 */
export interface LeagueFinishPoints {
  readonly first: bigint;
  readonly second: bigint;
  readonly third: bigint;
  readonly finalTable: bigint;
  readonly entry: bigint;
}

const LAST_FINAL_TABLE_PLACE = 9n;
// The club's day turns over at 06:00 IST. IST is UTC+05:30, so the club's clock runs at UTC-00:30.
const CLUB_CLOCK_OFFSET_MS = -30 * 60 * 1000;

function placePoints(place: bigint, schedule: LeagueFinishPoints): bigint {
  if (place === 1n) return schedule.first;
  if (place === 2n) return schedule.second;
  if (place === 3n) return schedule.third;
  return place <= LAST_FINAL_TABLE_PLACE ? schedule.finalTable : 0n;
}

/**
 * The League points for finishing a tournament in `place` (1 is the winner): the points for taking part,
 * plus the place's own (first, second, third, or the final table for fourth to ninth; nothing below
 * ninth). A place below 1 or a negative number of points is a bug and throws. The database's
 * private.league_finish_points is proved equal on packages/testing/golden/league.json.
 */
export function leagueFinishPoints(place: bigint, schedule: LeagueFinishPoints): bigint {
  if (place < 1n) throw new RangeError('A place is 1 or more');
  if (Object.values(schedule).some((points) => points < 0n)) throw new RangeError('League points are never negative');
  return schedule.entry + placePoints(place, schedule);
}

/**
 * The League month a moment belongs to, as its first day ("2026-11-01"): the month of the club's day,
 * which runs 06:00 to 06:00 IST, so a night that ends at 02:00 on the 1st counts in the month before.
 * The database's private.league_month is proved equal on the same golden file.
 */
export function leagueMonth(at: Date): string {
  const clock = new Date(at.getTime() + CLUB_CLOCK_OFFSET_MS);
  return `${String(clock.getUTCFullYear())}-${String(clock.getUTCMonth() + 1).padStart(2, '0')}-01`;
}
