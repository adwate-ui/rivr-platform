import { useTableMetrics, useTableMetricsTotal, type TableMetrics, type TableMetricsTotal } from '@rivr/db';
import { clubDay, dayAfter } from '@rivr/domain/clubDay';
import { changeFrom, isTableSpan, roomUse, tableSpanDays, tableUse } from '@rivr/domain/tables';
import { formatDuration, formatNumber, t } from '@rivr/i18n';
import { ChoiceChips, DataTable, ErrorMessage, Heading, Inline, Input, Stack, Text, type DataTableColumn } from '@rivr/ui';
import { useState } from 'react';

/** The spans the view offers: tonight's club day, the last 7, 30 or 90, or dates of one's own (F-107). */
const SPANS = { today: 1, week: 7, month: 30, quarter: 90 } as const;
type Span = keyof typeof SPANS | 'custom';
const SPAN_KEYS: readonly Span[] = ['today', 'week', 'month', 'quarter', 'custom'];

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

interface Range {
  readonly from: string;
  readonly to: string;
}

/** From and To for dates of one's own, taken once they make a span of 1 to 92 club days, none ahead of tonight. */
function ChosenDates({ range, today, onChange }: { range: Range; today: string; onChange: (range: Range) => void }) {
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);
  const isUsable = isTableSpan(from, to, today);
  const change = (next: Range) => {
    setFrom(next.from);
    setTo(next.to);
    if (isTableSpan(next.from, next.to, today)) onChange(next);
  };
  return (
    <Stack gap={2}>
      <Inline gap={4} align="start" wrap>
        <Input type="date" label={t('console.reports.tables.from')} value={from} onChange={(event) => change({ from: event.target.value, to })} />
        <Input type="date" label={t('console.reports.tables.to')} value={to} onChange={(event) => change({ from, to: event.target.value })} />
      </Inline>
      {isUsable ? null : <ErrorMessage>{t('console.reports.tables.badDates')}</ErrorMessage>}
    </Stack>
  );
}

function Results({ venueId, range, spanWords, exportIn }: { venueId: string; range: Range; spanWords: string; exportIn: HTMLElement | null }) {
  const metrics = useTableMetrics(venueId, range.from, range.to);
  const total = useTableMetricsTotal(venueId, range.from, range.to);
  const days = tableSpanDays(range.from, range.to);
  const base = {
    label: t('console.reports.tables.title'), columns: columns(), rowKey: (row: Line) => row.tableId, narrowLayout: 'scroll' as const,
    exportFilter: spanWords, exportIn,
  };
  if (metrics.isError || total.isError) {
    return <DataTable {...base} status="error" onRetry={() => { void metrics.refetch(); void total.refetch(); }} />;
  }
  if (metrics.data === undefined || total.data === undefined) return <DataTable {...base} status="loading" />;
  return (
    <Stack gap={3}>
      <DataTable {...base} rows={metrics.data} totalRow={totalLine(total.data)} emptyText={t('console.reports.tables.empty')} />
      <Text variant="small" tone="muted">{days === 1 ? t('console.reports.tables.changeNoteDay') : t('console.reports.tables.changeNote', { days: formatNumber(days) })}</Text>
    </Stack>
  );
}

/**
 * The MIS Tables view (the owner, 8 Nov), money-free: each active table over tonight, the last 7, 30 or 90 club days or dates of one's
 * own, with the hours it ran, the members who sat there, the most at once, the hours they played, how full it was and the change in
 * player hours against the span before; and under them a line for the whole room (F-107).
 */
export function TablesReport({ venueId, exportIn }: { venueId: string; exportIn: HTMLElement | null }) {
  const [span, setSpan] = useState<Span>('week');
  const to = clubDay(new Date());
  const [chosen, setChosen] = useState<Range>({ from: dayAfter(to, -29), to });
  const range = span === 'custom' ? chosen : { from: dayAfter(to, 1 - SPANS[span]), to };
  const spanWords = span === 'custom' ? t('console.exportFilters.period', { from: range.from, to: range.to })
    : t('console.exportFilters.choice', { label: t('console.reports.tables.span'), value: t(`console.reports.tables.spans.${span}`) });
  return (
    <Stack gap={4}>
      <Heading level={2}>{t('console.reports.tables.title')}</Heading>
      <ChoiceChips label={t('console.reports.tables.span')} isLabelVisuallyHidden mode="one" look="subtle" selected={[span]}
        options={SPAN_KEYS.map((value) => ({ value, label: t(`console.reports.tables.spans.${value}`) }))}
        onChange={([picked]) => setSpan(SPAN_KEYS.find((value) => value === picked) ?? 'week')} />
      {span === 'custom' ? <ChosenDates range={chosen} today={to} onChange={setChosen} /> : null}
      <Results venueId={venueId} range={range} spanWords={spanWords} exportIn={exportIn} />
    </Stack>
  );
}
