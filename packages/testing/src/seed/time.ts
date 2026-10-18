/**
 * The UTC instant of an IST wall-clock time: `ist('2026-11-17 00:10')`. Fixtures read in IST, as the
 * design prompt does; the database and every Date hold UTC.
 */
export function ist(wallClock: string): Date {
  const instant = new Date(`${wallClock.replace(' ', 'T')}:00+05:30`);
  if (Number.isNaN(instant.getTime())) throw new Error(`Not an IST time: ${wallClock}`);
  return instant;
}
