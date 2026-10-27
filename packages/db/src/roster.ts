import { err, ok, type Result } from '@rivr/contracts/result';
import type { RosterShifts } from '@rivr/contracts/staff';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRivrData } from './provider.tsx';

// Kept here, not in queryKeys: this module is its own subpath (@rivr/db/roster), off the player's first load.
const keys = {
  week: (userId: string, venueId: string, week: string) => ['user', userId, 'roster', venueId, week] as const,
  all: (userId: string, venueId: string) => ['user', userId, 'roster', venueId] as const,
};

/** Whether a rostered shift was worked (#106). */
export type Attendance = 'present' | 'late' | 'absent';

/** One rostered shift: who, the job title worked, the club day, when, and its attendance once recorded. */
export interface RosterShift {
  readonly shiftId: string;
  readonly staffId: string;
  readonly fullName: string;
  readonly jobTitle: string;
  /** The club day, `2026-11-16`. */
  readonly clubDay: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly attendance: Attendance | null;
  readonly note: string | null;
}

/** Why a roster change did not go through: `overlap` is a shift that would overlap one of theirs. */
export type RosterFailure = 'not_allowed' | 'invalid' | 'overlap' | 'paused' | 'unavailable';

const FAILURE_BY_CODE: Readonly<Record<string, RosterFailure>> = { '42501': 'not_allowed', '22023': 'invalid', RVOVL: 'overlap', RVFRZ: 'paused' };
const failureOf = (code: string): RosterFailure => FAILURE_BY_CODE[code] ?? 'unavailable';
const isAttendance = (status: string | null): status is Attendance => status === 'present' || status === 'late' || status === 'absent';

/** A week's roster from its Monday (`2026-11-16`), by job title and name, for staff who manage staff. */
export function useRosterWeek(venueId: string, week: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: keys.week(userId ?? 'signed-out', venueId, week),
    enabled: userId !== null,
    queryFn: async (): Promise<RosterShift[]> => {
      const { data, error } = await client.rpc('roster_week', { p_venue_id: venueId, p_week: week });
      if (error) throw error;
      return data.map((row) => ({
        shiftId: row.shift_id, staffId: row.staff_id, fullName: row.full_name, jobTitle: row.job_title, clubDay: row.club_day,
        startsAt: row.starts_at, endsAt: row.ends_at, attendance: isAttendance(row.attendance) ? row.attendance : null, note: row.note,
      }));
    },
  });
}

/**
 * Keeps the roster (#106): `add` shifts for staff on days, `copyWeek` from one week to another, `record` a shift's
 * attendance. Each a Result, and every roster week reloads.
 */
export function useRosterActions(venueId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  const settle = async <Value>(value: Value, error: { code: string } | null): Promise<Result<Value, RosterFailure>> => {
    await queryClient.invalidateQueries({ queryKey: keys.all(userId ?? 'signed-out', venueId) });
    return error ? err(failureOf(error.code)) : ok(value);
  };
  const add = useMutation({
    mutationFn: async ({ staffIds, days, starts, ends }: RosterShifts) => {
      const { data, error } = await client.rpc('add_shifts', { p_venue_id: venueId, p_staff_ids: [...staffIds], p_days: [...days], p_starts: starts, p_ends: ends });
      return settle(data ?? 0, error);
    },
  });
  const copyWeek = useMutation({
    mutationFn: async ({ from, to }: { from: string; to: string }) => {
      const { data, error } = await client.rpc('copy_roster_week', { p_venue_id: venueId, p_from: from, p_to: to });
      return settle(data ?? 0, error);
    },
  });
  const record = useMutation({
    mutationFn: async ({ shiftId, status }: { shiftId: string; status: Attendance }) => {
      const { error } = await client.rpc('record_attendance', { p_shift_id: shiftId, p_status: status });
      return settle(null, error);
    },
  });
  return { add, copyWeek, record };
}
