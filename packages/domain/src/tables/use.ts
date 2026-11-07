/**
 * How full a table was over a span (the owner, 8 Nov: "% utilisation"): the seconds members sat there over its seats ×
 * the seconds it ran, as a whole percent rounded down and never above 100; null when it never ran or has no seats.
 */
export function tableUse(playerSeconds: number, seats: number, runSeconds: number): number | null {
  if (runSeconds <= 0 || seats <= 0) return null;
  return Math.min(100, Math.floor((Math.max(0, playerSeconds) * 100) / (seats * runSeconds)));
}
