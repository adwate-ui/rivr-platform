import type { RosterShift } from '@rivr/db/roster';
import { describe, expect, it } from 'vitest';
import { rosterRows } from './rosterRows.ts';

const shift = (staffId: string, clubDay: string, startsAt: string): RosterShift => ({
  shiftId: `${staffId}-${startsAt}`, staffId, fullName: `Name ${staffId}`, jobTitle: 'Cashier', clubDay, startsAt, endsAt: startsAt,
  attendance: null, note: null,
});

describe('rosterRows', () => {
  it('gives each staff member one row, in the order the roster came, with each day\'s shifts', () => {
    const rows = rosterRows([
      shift('a', '2026-11-16', '2026-11-16T12:30:00Z'), shift('b', '2026-11-16', '2026-11-16T12:30:00Z'),
      shift('a', '2026-11-17', '2026-11-17T12:30:00Z'), shift('a', '2026-11-17', '2026-11-17T20:30:00Z'),
    ]);
    expect(rows.map((row) => row.staffId)).toEqual(['a', 'b']);
    expect(Object.keys(rows[0]?.days ?? {})).toEqual(['2026-11-16', '2026-11-17']);
    expect(rows[0]?.days['2026-11-17']?.map((one) => one.startsAt)).toEqual(['2026-11-17T12:30:00Z', '2026-11-17T20:30:00Z']);
  });

  it('gives no rows for an empty week', () => {
    expect(rosterRows([])).toEqual([]);
  });
});
