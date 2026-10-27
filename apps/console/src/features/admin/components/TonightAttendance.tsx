import { useRosterActions, type Attendance, type RosterFailure, type RosterShift } from '@rivr/db/roster';
import { formatTime, t } from '@rivr/i18n';
import { ChoiceChips, DataTable, ErrorMessage, Heading, Stack, type DataTableColumn } from '@rivr/ui';
import { useState } from 'react';
import { ROSTER_FAILURE_COPY } from './rosterCopy.ts';

const STATUSES: readonly Attendance[] = ['present', 'late', 'absent'];

function columns(onRecord: (shiftId: string, status: Attendance) => void): readonly DataTableColumn<RosterShift>[] {
  return [
    { key: 'name', header: t('console.roster.name'), cell: (row) => row.fullName, sortValue: (row) => row.fullName },
    { key: 'jobTitle', header: t('console.roster.jobTitle'), cell: (row) => row.jobTitle, sortValue: (row) => row.jobTitle },
    {
      key: 'shift', header: t('console.roster.shiftTimes'),
      cell: (row) => t('console.roster.shift', { starts: formatTime(new Date(row.startsAt)), ends: formatTime(new Date(row.endsAt)) }),
    },
    {
      key: 'attendance', header: t('console.roster.tonightTitle'),
      cell: (row) => (
        <ChoiceChips label={t('console.roster.attendanceFor', { name: row.fullName })} isLabelVisuallyHidden mode="one"
          selected={row.attendance === null ? [] : [row.attendance]} onChange={(picked) => { if (picked[0] !== undefined) onRecord(row.shiftId, picked[0]); }}
          options={STATUSES.map((value) => ({ value, label: t(`console.roster.attendance.${value}`) }))} />
      ),
    },
  ];
}

/** Tonight's shifts, each with its attendance: present, late or absent, recorded as it is chosen. */
export function TonightAttendance({ venueId, shifts }: { venueId: string; shifts: readonly RosterShift[] }) {
  const { record } = useRosterActions(venueId);
  const [failure, setFailure] = useState<RosterFailure | null>(null);
  const onRecord = async (shiftId: string, status: Attendance) => {
    const done = await record.mutateAsync({ shiftId, status });
    setFailure(done.ok ? null : done.error);
  };
  return (
    <Stack gap={4}>
      <Heading level={2}>{t('console.roster.tonightTitle')}</Heading>
      {failure === null ? null : <ErrorMessage>{t(ROSTER_FAILURE_COPY[failure])}</ErrorMessage>}
      <DataTable label={t('console.roster.tonightLabel')} columns={columns((shiftId, status) => void onRecord(shiftId, status))}
        rowKey={(row) => row.shiftId} rows={shifts} emptyText={t('console.roster.tonightEmpty')} />
    </Stack>
  );
}
