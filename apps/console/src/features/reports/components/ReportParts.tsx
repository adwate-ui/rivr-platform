import { useReportChart, useReportFigures, type ChartReport, type FigureReport } from '@rivr/db';
import { formatChips, formatDayMonth, formatDuration, formatNumber, formatTime, t, type MessageKey } from '@rivr/i18n';
import { BarChart, DataTable, StatRow, type DataTableColumn } from '@rivr/ui';
import type { ReportPeriod } from './ReportPeriod.tsx';

// What every report beside Tables is made of (redesign RD-27): four figures, a chart by the hour or the day, and a table.

/** How a figure reads: a count, a length of time in whole seconds, or Bonus kept in paise. */
type FigureKind = 'count' | 'duration' | 'bonus';

/** A figure in words; a dash while it has not come. */
export function figureWords(kind: FigureKind, amount: number | undefined): string {
  if (amount === undefined) return t('console.reports.noFigure');
  if (kind === 'duration') return formatDuration(amount);
  return kind === 'bonus' ? formatChips(BigInt(Math.round(amount))) : formatNumber(amount);
}

/** Each report's four figures, as `report_figures` names them, in the order they show. */
const FIGURES = {
  players: [
    { figure: 'check_ins', kind: 'count', label: 'console.reports.tiles.checkIns' }, { figure: 'played', kind: 'count', label: 'console.reports.tiles.played' },
    { figure: 'new_members', kind: 'count', label: 'console.reports.tiles.newMembers' }, { figure: 'session_seconds', kind: 'duration', label: 'console.reports.tiles.session' },
  ],
  waitlist: [
    { figure: 'joined', kind: 'count', label: 'console.reports.tiles.joined' }, { figure: 'seated', kind: 'count', label: 'console.reports.tiles.seated' },
    { figure: 'wait_seconds', kind: 'duration', label: 'console.reports.tiles.wait' }, { figure: 'longest_seconds', kind: 'duration', label: 'console.reports.tiles.longest' },
  ],
  fnb: [
    { figure: 'orders', kind: 'count', label: 'console.reports.tiles.orders' }, { figure: 'items', kind: 'count', label: 'console.reports.tiles.items' },
    { figure: 'accept_seconds', kind: 'duration', label: 'console.reports.tiles.accept' }, { figure: 'serve_seconds', kind: 'duration', label: 'console.reports.tiles.serve' },
  ],
  bonus: [
    { figure: 'given', kind: 'bonus', label: 'console.reports.tiles.given' }, { figure: 'by_hand', kind: 'bonus', label: 'console.reports.tiles.byHand' },
    { figure: 'used', kind: 'bonus', label: 'console.reports.tiles.used' }, { figure: 'outstanding', kind: 'bonus', label: 'console.reports.tiles.outstanding' },
  ],
} as const satisfies Record<FigureReport, readonly { figure: string; kind: FigureKind; label: MessageKey }[]>;

interface PartProps {
  venueId: string;
  period: ReportPeriod;
}

/** A report's four figures over the period, a dash for each until they come. */
export function ReportFigures({ venueId, period, report }: PartProps & { report: FigureReport }) {
  const figures = useReportFigures({ venueId, from: period.from, to: period.to }, report);
  const amountOf = (name: string) => figures.data?.find((one) => one.figure === name)?.amount;
  return <StatRow size="medium" stats={FIGURES[report].map(({ figure, kind, label }) => ({ label: t(label), value: figureWords(kind, amountOf(figure)) }))} />;
}

/** A report's chart: a bar an hour over one club day, a bar a club day over more. Bonus reads as Bonus; anything else is a count. */
export function ReportChart({ venueId, period, report }: PartProps & { report: ChartReport }) {
  const chart = useReportChart({ venueId, from: period.from, to: period.to }, report);
  const isOneDay = period.from === period.to;
  const bars = (chart.data ?? []).map((bar) => ({
    label: isOneDay ? formatTime(new Date(bar.at)) : formatDayMonth(new Date(bar.at)), value: bar.amount,
    valueText: figureWords(report === 'bonus' ? 'bonus' : 'count', bar.amount),
  }));
  return <BarChart label={t(`console.reports.chartNames.${report}.${isOneDay ? 'byHour' : 'byDay'}`)} bars={bars} />;
}

interface ReportTableProps<Line> extends Pick<PartProps, 'period'> {
  label: string;
  /** The report's read: its lines, or that they are loading or did not come. */
  lines: { readonly data: readonly Line[] | undefined; readonly isError: boolean; readonly refetch: () => unknown };
  columns: readonly DataTableColumn<Line>[];
  rowKey: (line: Line) => string;
  emptyText: string;
  exportIn: HTMLElement | null;
}

/** A report's table, with the screen's Export, which records the period. */
export function ReportTable<Line>({ label, lines, columns, rowKey, emptyText, period, exportIn }: ReportTableProps<Line>) {
  const base = { label, columns, rowKey, narrowLayout: 'scroll' as const, exportFilter: period.words, exportIn };
  if (lines.isError) return <DataTable {...base} status="error" onRetry={() => void lines.refetch()} />;
  if (lines.data === undefined) return <DataTable {...base} status="loading" />;
  return <DataTable {...base} rows={lines.data} emptyText={emptyText} />;
}
