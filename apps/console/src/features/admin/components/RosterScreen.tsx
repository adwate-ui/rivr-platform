import { useStaffVenue } from '@rivr/db';
import { useRosterWeek, type RosterShift } from '@rivr/db/roster';
import { clubDay, dayAfter, weekOf } from '@rivr/domain/clubDay';
import { formatDayMonth, formatTime, formatWeekday, t } from '@rivr/i18n';
import { ChoiceChips, DataTable, Screen, Stack, type DataTableColumn } from '@rivr/ui';
import { useState } from 'react';
import { AddShiftsForm, CopyWeekButton } from './RosterForms.tsx';
import { noonOf, rosterRows, type RosterRow } from './rosterRows.ts';
import { TonightAttendance } from './TonightAttendance.tsx';

/** A day's shifts as the roster shows them: `18:00–02:00`, each with its attendance once recorded; none is off. */
function dayText(shifts: readonly RosterShift[] | undefined): string {
  if (shifts === undefined || shifts.length === 0) return t('console.roster.off');
  return shifts.map(shiftText).join(t('console.roster.between'));
}

function shiftText(shift: RosterShift): string {
  const times = { starts: formatTime(new Date(shift.startsAt)), ends: formatTime(new Date(shift.endsAt)) };
  return shift.attendance === null ? t('console.roster.shift', times)
    : t('console.roster.shiftWithAttendance', { ...times, attendance: t(`console.roster.attendance.${shift.attendance}`) });
}

function columns(days: readonly string[]): readonly DataTableColumn<RosterRow>[] {
  return [
    { key: 'name', header: t('console.roster.name'), cell: (row) => row.fullName, sortValue: (row) => row.fullName },
    { key: 'jobTitle', header: t('console.roster.jobTitle'), cell: (row) => row.jobTitle, sortValue: (row) => row.jobTitle },
    ...days.map((day): DataTableColumn<RosterRow> => ({
      key: day, header: t('console.roster.day', { weekday: formatWeekday(noonOf(day)), day: formatDayMonth(noonOf(day)) }),
      cell: (row) => dayText(row.days[day]),
    })),
  ];
}

function RosterPanel({ venueId }: { venueId: string }) {
  // Read on each render, so tonight moves on at 06:00 when the roster next reloads.
  const today = clubDay(new Date());
  const thisWeek = weekOf(today);
  const weeks = [thisWeek, dayAfter(thisWeek, 7), dayAfter(thisWeek, 14)];
  const [week, setWeek] = useState(thisWeek);
  const roster = useRosterWeek(venueId, week);
  const days = Array.from({ length: 7 }, (_, index) => dayAfter(week, index));
  const state = roster.isPending ? { status: 'loading' as const }
    : roster.isError ? { status: 'error' as const, onRetry: () => void roster.refetch() }
    : { rows: rosterRows(roster.data), emptyText: t('console.roster.empty') };
  return (
    <Stack gap={6}>
      <ChoiceChips label={t('console.roster.week')} mode="one" selected={[week]} onChange={(picked) => setWeek(picked[0] ?? week)}
        options={weeks.map((first) => ({ value: first, label: t('console.roster.weekOf', { day: formatDayMonth(noonOf(first)) }) }))} />
      <DataTable label={t('console.roster.tableLabel')} columns={columns(days)} rowKey={(row) => row.staffId} {...state} />
      <AddShiftsForm key={week} venueId={venueId} days={days.filter((day) => day >= today)} />
      <CopyWeekButton venueId={venueId} week={week} />
      {week === thisWeek && roster.data !== undefined
        ? <TonightAttendance venueId={venueId} shifts={roster.data.filter((shift) => shift.clubDay === today)} /> : null}
    </Stack>
  );
}

/**
 * The roster (#106; scope-v1 module 10; decision 0236), for staff who manage staff: a week's shifts by job title, shifts
 * added for the staff of a job title on the days chosen, the week before copied, and tonight's attendance.
 */
export function RosterScreen() {
  const staff = useStaffVenue();
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  const title = t('console.roster.title');
  if (!staff.venue.permissions.includes('staff.manage')) return <Screen title={title} status="error" errorText={t('console.roster.notAllowed')} />;
  return (
    <Screen title={title}>
      <RosterPanel venueId={staff.venue.venueId} />
    </Screen>
  );
}
