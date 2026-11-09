/**
 * How full a table was over a span (the owner, 8 Nov: "% utilisation"): the seconds members sat there over its seats ×
 * the seconds it ran, as a whole percent rounded down and never above 100; null when it never ran or has no seats.
 */
export function tableUse(playerSeconds: number, seats: number, runSeconds: number): number | null {
  if (runSeconds <= 0 || seats <= 0) return null;
  return Math.min(100, Math.floor((Math.max(0, playerSeconds) * 100) / (seats * runSeconds)));
}

/** How full the whole room was over a span: the seconds played over its tables' seats × the seconds each ran. */
export function roomUse(playerSeconds: number, seatSeconds: number): number | null {
  return tableUse(playerSeconds, 1, seatSeconds);
}

/** The whole-percent change from the span before, rounded; null with nothing before to compare it with (F-107). */
export function changeFrom(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) * 100) / previous);
}

const DAY_MS = 86_400_000;
const LONGEST_SPAN_DAYS = 92;

/** How many club days `from` to `to` (YYYY-MM-DD) cover, both counted. */
export function tableSpanDays(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS) + 1;
}

/** Whether a table report can cover from `from` to `to`: 1 to 92 club days, as `table_metrics` takes, none ahead of today. */
export function isTableSpan(from: string, to: string, today: string): boolean {
  if (from === '' || to === '' || to > today) return false;
  const days = tableSpanDays(from, to);
  return days >= 1 && days <= LONGEST_SPAN_DAYS;
}
