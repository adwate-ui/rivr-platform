const SECONDS_PER_HOUR = 3_600n;

/** A hotel night is kept in thousandths, so the hours at different stakes, and on different visits, add up. */
export const NIGHT = 1_000n;

/**
 * Accommodation rewards (#146; question #486; decision 0246): the thousandths of a hotel night a table type's
 * accommodation.hours_per_night gives for the seconds played there, rounded down. At 20 hours a night, 5 hours is
 * 250, a quarter of a night. A negative time, or a rate under an hour, is a bug and throws. The database's
 * private.nights_for_time is proved equal on packages/testing/golden/accommodation.json.
 */
export function nightsForTime(playedSeconds: bigint, hoursPerNight: bigint): bigint {
  if (playedSeconds < 0n) throw new RangeError('Time played is never negative');
  if (hoursPerNight < 1n) throw new RangeError('A night takes an hour or more');
  return (playedSeconds * NIGHT) / (hoursPerNight * SECONDS_PER_HOUR);
}
