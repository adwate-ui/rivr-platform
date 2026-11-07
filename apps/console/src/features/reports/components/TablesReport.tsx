import { useTableMetrics, type TableMetrics } from '@rivr/db';
import { clubDay, dayAfter } from '@rivr/domain/clubDay';
import { tableUse } from '@rivr/domain/tables';
import { formatHoursMinutes, formatNumber, t } from '@rivr/i18n';
import { ChoiceChips, DataTable, Stack, Text, type DataTableColumn } from '@rivr/ui';
import { useState } from 'react';

/** The spans the view offers: tonight's club day, the last 7 or the last 30. */
const SPANS = { today: 1, week: 7, month: 30 } as const;
type Span = keyof typeof SPANS;
const SPAN_KEYS: readonly Span[] = ['today', 'week', 'month'];

const fullnessOf = (row: TableMetrics) => tableUse(row.playerSeconds, row.seats, row.runSeconds);

/** The columns (owner, 8 Nov): the table, its seats, hours run, players, the most at once, player hours and how full. */
function columns(): readonly DataTableColumn<TableMetrics>[] {
  return [
    { key: 'table', header: t('console.reports.tables.table'), cell: (row) => row.tableName, sortValue: (row) => row.tableName },
    { key: 'seats', header: t('console.reports.tables.seats'), cell: (row) => formatNumber(row.seats), sortValue: (row) => row.seats, align: 'end' },
    {
      key: 'run', header: t('console.reports.tables.hoursRun'), align: 'end', sortValue: (row) => row.runSeconds,
      cell: (row) => formatHoursMinutes(row.runSeconds),
    },
    { key: 'players', header: t('console.reports.tables.players'), cell: (row) => formatNumber(row.players), sortValue: (row) => row.players, align: 'end' },
    { key: 'peak', header: t('console.reports.tables.peak'), cell: (row) => formatNumber(row.peak), sortValue: (row) => row.peak, align: 'end' },
    {
      key: 'played', header: t('console.reports.tables.playerHours'), align: 'end', sortValue: (row) => row.playerSeconds,
      cell: (row) => formatHoursMinutes(row.playerSeconds),
    },
    {
      key: 'use', header: t('console.reports.tables.use'), align: 'end', sortValue: (row) => fullnessOf(row) ?? -1,
      cell: (row) => {
        const fullness = fullnessOf(row);
        return fullness === null ? '' : t('console.reports.tables.percent', { percent: String(fullness) });
      },
    },
  ];
}

/**
 * The MIS Tables view (the owner, 8 Nov), money-free: each table over tonight, the last 7 or the last 30 club days, with
 * the hours it ran, the members who sat there, the most at once, the hours they played and how full it was.
 */
export function TablesReport({ venueId }: { venueId: string }) {
  const [span, setSpan] = useState<Span>('week');
  const to = clubDay(new Date());
  const metrics = useTableMetrics(venueId, dayAfter(to, 1 - SPANS[span]), to);
  const base = { label: t('console.reports.tables.title'), columns: columns(), rowKey: (row: TableMetrics) => row.tableId, narrowLayout: 'scroll' as const };
  return (
    <Stack gap={4}>
      <Text tone="muted">{t('console.reports.tables.hint')}</Text>
      <ChoiceChips label={t('console.reports.tables.span')} isLabelVisuallyHidden mode="one" look="subtle" selected={[span]}
        options={SPAN_KEYS.map((value) => ({ value, label: t(`console.reports.tables.spans.${value}`) }))}
        onChange={([picked]) => setSpan(SPAN_KEYS.find((value) => value === picked) ?? 'week')} />
      {metrics.isError ? <DataTable {...base} status="error" onRetry={() => void metrics.refetch()} />
        : metrics.data === undefined ? <DataTable {...base} status="loading" />
        : <DataTable {...base} rows={metrics.data} emptyText={t('console.reports.tables.empty')} />}
    </Stack>
  );
}
