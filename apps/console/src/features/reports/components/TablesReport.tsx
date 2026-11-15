import { useTableMetrics, useTableMetricsTotal, type TableMetrics, type TableMetricsTotal } from '@rivr/db';
import { changeFrom, roomUse, tableSpanDays, tableUse } from '@rivr/domain/tables';
import { formatDuration, formatNumber, t } from '@rivr/i18n';
import { DataTable, Stack, StatRow, Text, type DataTableColumn } from '@rivr/ui';
import type { ReportProps } from './ClubReports.tsx';
import { figureWords, ReportChart } from './ReportParts.tsx';

/** A table's line, or the whole room's under them, which has its seats' seconds for how full it was. */
type Line = TableMetrics & { readonly seatSeconds?: number };

const fullnessOf = (row: Line) => (row.seatSeconds === undefined ? tableUse(row.playerSeconds, row.seats, row.runSeconds) : roomUse(row.playerSeconds, row.seatSeconds));
const changeOf = (row: Line) => changeFrom(row.playerSeconds, row.previousPlayerSeconds);

/** Player hours against the span before: `+12%`, `−5%`, or a dash with nothing to compare. */
function changeWords(row: Line): string {
  const change = changeOf(row);
  if (change === null) return t('console.reports.tables.noChange');
  return t(change > 0 ? 'console.reports.tables.up' : 'console.reports.tables.percent', { percent: formatNumber(change) });
}

/** The columns (owner, 8 Nov): the table, its seats, hours run, players, the most at once, player hours and how full; and the change (F-107). */
function columns(): readonly DataTableColumn<Line>[] {
  return [
    { key: 'table', header: t('console.reports.tables.table'), cell: (row) => row.tableName, sortValue: (row) => row.tableName, filter: 'text' },
    { key: 'seats', header: t('console.reports.tables.seats'), cell: (row) => formatNumber(row.seats), sortValue: (row) => row.seats, align: 'end' },
    {
      key: 'run', filter: 'duration', header: t('console.reports.tables.hoursRun'), align: 'end', sortValue: (row) => row.runSeconds,
      cell: (row) => formatDuration(row.runSeconds), exportValue: (row) => formatDuration(row.runSeconds),
    },
    { key: 'players', header: t('console.reports.tables.players'), cell: (row) => formatNumber(row.players), sortValue: (row) => row.players, align: 'end' },
    { key: 'peak', header: t('console.reports.tables.peak'), cell: (row) => formatNumber(row.peak), sortValue: (row) => row.peak, align: 'end' },
    {
      key: 'played', filter: 'duration', header: t('console.reports.tables.playerHours'), align: 'end', sortValue: (row) => row.playerSeconds,
      cell: (row) => formatDuration(row.playerSeconds), exportValue: (row) => formatDuration(row.playerSeconds),
    },
    {
      key: 'use', header: t('console.reports.tables.use'), align: 'end', sortValue: (row) => fullnessOf(row) ?? -1,
      exportValue: (row) => fullnessOf(row) ?? '',
      cell: (row) => {
        const fullness = fullnessOf(row);
        return fullness === null ? '' : t('console.reports.tables.percent', { percent: String(fullness) });
      },
    },
    { key: 'change', header: t('console.reports.tables.change'), align: 'end', filter: 'number', sortValue: (row) => changeOf(row) ?? '', cell: changeWords, exportValue: changeWords },
  ];
}

/** The room's line, under the tables: everywhere, whatever the table's own filters leave. */
function totalLine(total: TableMetricsTotal): Line {
  return { ...total, tableId: 'all-tables', tableName: t('console.reports.tables.allTables') };
}

/** The room's four figures over the tables (redesign RD-27): how full it was, the most seated at once, the hours played and who played. */
function roomFigures(total: TableMetricsTotal | undefined) {
  const use = total === undefined ? null : roomUse(total.playerSeconds, total.seatSeconds);
  return [
    { label: t('console.reports.tiles.seatUse'), value: use === null ? t('console.reports.noFigure') : t('console.reports.tables.percent', { percent: String(use) }) },
    { label: t('console.reports.tiles.peak'), value: figureWords('count', total?.peak) },
    { label: t('console.reports.tiles.playerHours'), value: figureWords('duration', total?.playerSeconds) },
    { label: t('console.reports.tiles.players'), value: figureWords('count', total?.players) },
  ];
}

/**
 * The MIS Tables view (the owner, 8 Nov), money-free: each active table over tonight, the last 7, 30 or 90 club days or dates of one's
 * own, with the hours it ran, the members who sat there, the most at once, the hours they played, how full it was and the change in
 * player hours against the span before; and under them a line for the whole room (F-107). Over the table, the room's four figures
 * and the members seated by the hour or the day (redesign RD-27).
 */
export function TablesReport({ venueId, period, exportIn }: ReportProps) {
  const metrics = useTableMetrics(venueId, period.from, period.to);
  const total = useTableMetricsTotal(venueId, period.from, period.to);
  const days = tableSpanDays(period.from, period.to);
  const lines = { data: total.data === undefined ? undefined : metrics.data, isError: metrics.isError || total.isError, refetch: () => { void metrics.refetch(); void total.refetch(); } };
  const base = { label: t('console.reports.tables.title'), columns: columns(), rowKey: (row: Line) => row.tableId, narrowLayout: 'scroll' as const, exportFilter: period.words, exportIn };
  return (
    <Stack gap={4}>
      <StatRow size="medium" stats={roomFigures(total.data)} />
      <ReportChart venueId={venueId} period={period} report="tables" />
      {lines.isError ? <DataTable {...base} status="error" onRetry={lines.refetch} /> : null}
      {!lines.isError && lines.data === undefined ? <DataTable {...base} status="loading" /> : null}
      {lines.isError || lines.data === undefined || total.data === undefined ? null : (
        <DataTable {...base} rows={lines.data} totalRow={totalLine(total.data)} emptyText={t('console.reports.tables.empty')} />
      )}
      <Text variant="small" tone="muted">{days === 1 ? t('console.reports.tables.changeNoteDay') : t('console.reports.tables.changeNote', { days: formatNumber(days) })}</Text>
    </Stack>
  );
}
