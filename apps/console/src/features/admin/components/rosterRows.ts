import type { RosterShift } from '@rivr/db/roster';

/** One staff member's row of a week's roster: their shifts on each of its days, in order. */
export interface RosterRow {
  readonly staffId: string;
  readonly fullName: string;
  readonly jobTitle: string;
  readonly days: Readonly<Record<string, readonly RosterShift[]>>;
}

/** A week's shifts as rows, one a staff member, in the roster's order (job title, then name, then start). */
export function rosterRows(shifts: readonly RosterShift[]): RosterRow[] {
  const rows = new Map<string, { staffId: string; fullName: string; jobTitle: string; days: Record<string, RosterShift[]> }>();
  for (const shift of shifts) {
    const row = rows.get(shift.staffId) ?? { staffId: shift.staffId, fullName: shift.fullName, jobTitle: shift.jobTitle, days: {} };
    (row.days[shift.clubDay] ??= []).push(shift);
    rows.set(shift.staffId, row);
  }
  return [...rows.values()];
}

/** A club day (`2026-11-16`) as a moment to format: its noon in India. */
export const noonOf = (day: string) => new Date(`${day}T12:00:00+05:30`);
