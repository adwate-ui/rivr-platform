import { useCreditReport, type CreditReportRow } from '@rivr/db';
import { t } from '@rivr/i18n';
import { DataTable, Heading, Input, Money, Stack, type DataTableColumn } from '@rivr/ui';
import type { Paise } from '@rivr/domain/money';
import { useState } from 'react';

const IST_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' });

const money = (key: string, header: string, paise: (row: CreditReportRow) => Paise): DataTableColumn<CreditReportRow> => ({
  key, header, align: 'end', sortValue: paise, cell: (row) => <Money paise={paise(row)} />,
});

function columns(): readonly DataTableColumn<CreditReportRow>[] {
  return [
    { key: 'player', header: t('console.markers.player'), cell: (row) => row.fullName, sortValue: (row) => row.fullName },
    money('0_7', t('console.markers.age0to7'), (row) => row.owed['0_7']),
    money('8_30', t('console.markers.age8to30'), (row) => row.owed['8_30']),
    money('31_60', t('console.markers.age31to60'), (row) => row.owed['31_60']),
    money('over_60', t('console.markers.ageOver60'), (row) => row.owed.over_60),
    money('owed', t('console.markers.owed'), (row) => row.total),
    money('limit', t('console.markers.limit'), (row) => row.limit),
    {
      key: 'pastDue', header: t('console.markers.pastDueColumn'), sortValue: (row) => (row.isPastDue ? 1 : 0),
      cell: (row) => (row.isPastDue ? t('console.markers.yes') : t('console.markers.no')),
    },
  ];
}

/** The report's rows, or the table's loading or error state. */
function ReportRows({ venueId, day }: { venueId: string; day: string }) {
  const report = useCreditReport(venueId, new Date(`${day}T23:59:59.999+05:30`).toISOString());
  const base = { label: t('console.markers.reportLabel'), columns: columns(), rowKey: (row: CreditReportRow) => row.memberId };
  if (report.data === undefined && report.isError) return <DataTable {...base} status="error" onRetry={() => void report.refetch()} />;
  if (report.data === undefined) return <DataTable {...base} status="loading" />;
  return <DataTable {...base} rows={report.data} emptyText={t('console.markers.reportEmpty')} initialSort={{ key: 'owed', direction: 'descending' }} />;
}

/**
 * The daily credit report (#92): what each member owed on markers at the end of a day in India time, by
 * age (0 to 7 days, 8 to 30, 31 to 60, over 60), against their limit. A past day stands as it was.
 */
export function CreditReport({ venueId }: { venueId: string }) {
  const [day, setDay] = useState(() => IST_DAY.format(new Date()));
  return (
    <Stack gap={4}>
      <Heading level={2}>{t('console.markers.report')}</Heading>
      <Input type="date" label={t('console.markers.reportDay')} value={day} onChange={(event) => setDay(event.target.value)} />
      {day === '' ? null : <ReportRows venueId={venueId} day={day} />}
    </Stack>
  );
}
