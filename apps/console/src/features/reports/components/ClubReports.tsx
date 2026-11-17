import {
  useBonusReport, useFnbReport, usePlayersReport, useWaitlistReport, type BonusLine, type FnbLine, type PlayersLine, type WaitlistLine,
} from '@rivr/db';
import { shareOf } from '@rivr/domain/tables';
import { formatChips, formatDuration, formatNumber, formatRupeesForFile, t } from '@rivr/i18n';
import { ChoiceChips, Stack, type DataTableColumn } from '@rivr/ui';
import { useState } from 'react';
import { BonusGivenList } from './BonusGivenList.tsx';
import { PlayerVisits } from './PlayerVisits.tsx';
import { ReportChart, ReportFigures, ReportTable } from './ReportParts.tsx';
import type { ReportPeriod } from './ReportPeriod.tsx';

// Players, Waitlist, Food and drink and Bonus (redesign RD-27), each in the Tables pattern: figures, a chart, a table. No rupee figure.

export interface ReportProps {
  venueId: string;
  period: ReportPeriod;
  exportIn: HTMLElement | null;
}

const spanOf = ({ venueId, period }: ReportProps) => ({ venueId, from: period.from, to: period.to });

/** A count column, sorted and filtered as a number. */
function count<Line>(key: string, header: string, value: (line: Line) => number): DataTableColumn<Line> {
  return { key, header, align: 'end', filter: 'number', sortValue: value, cell: (line) => formatNumber(value(line)) };
}

/** A length of time, sorted and filtered as one. */
function duration<Line>(key: string, header: string, seconds: (line: Line) => number): DataTableColumn<Line> {
  return { key, header, align: 'end', filter: 'duration', sortValue: seconds, cell: (line) => formatDuration(seconds(line)), exportValue: (line) => formatDuration(seconds(line)) };
}

/** A Players line in words: a tier by its name. */
function measureWords(line: PlayersLine): string {
  if (line.measure === 'tier') return line.label ?? '';
  if (line.measure === 'played') return t('console.reports.playersReport.played');
  return t(line.measure === 'first_visit' ? 'console.reports.playersReport.firstVisit' : 'console.reports.playersReport.idChecks');
}

/** Players: check-ins, members who played, new members and the average session; then who played, by tier and on a first visit, and the ID checks done. */
export function PlayersReport(props: ReportProps) {
  const lines = usePlayersReport(spanOf(props));
  const played = lines.data?.find((line) => line.measure === 'played')?.amount ?? 0;
  // An ID check is no share of the members who played.
  const share = (line: PlayersLine) => (line.measure === 'id_checks' ? null : shareOf(line.amount, played));
  const columns: readonly DataTableColumn<PlayersLine>[] = [
    { key: 'measure', header: t('console.reports.playersReport.measure'), isWide: true, filter: 'text', sortValue: measureWords, cell: measureWords },
    count('amount', t('console.reports.playersReport.value'), (line) => line.amount),
    {
      key: 'share', header: t('console.reports.playersReport.share'), align: 'end', filter: 'number', sortValue: (line) => share(line) ?? -1, exportValue: (line) => share(line) ?? '',
      cell: (line) => { const percent = share(line); return percent === null ? t('console.reports.noFigure') : t('console.reports.tables.percent', { percent: String(percent) }); },
    },
  ];
  return (
    <Stack gap={4}>
      <ReportFigures {...props} report="players" />
      <ReportChart {...props} report="players" />
      <ReportTable {...props} label={t('console.reports.playersReport.title')} lines={lines} columns={columns} rowKey={(line) => `${line.measure}:${line.label ?? ''}`}
        emptyText={t('console.reports.playersReport.empty')} />
      {/* Every visit in the span, as the door lists the day's players (decision 0682). */}
      <PlayerVisits span={spanOf(props)} periodWords={props.period.words} />
    </Stack>
  );
}

/** Waitlist: who joined a list, who got a seat and how long they waited; then each table's own list. */
export function WaitlistReport(props: ReportProps) {
  const lines = useWaitlistReport(spanOf(props));
  const columns: readonly DataTableColumn<WaitlistLine>[] = [
    { key: 'table', header: t('console.reports.waitlistReport.table'), filter: 'text', sortValue: (line) => line.tableName, cell: (line) => line.tableName },
    count('joined', t('console.reports.waitlistReport.joined'), (line) => line.joined),
    count('seated', t('console.reports.waitlistReport.seated'), (line) => line.seated),
    count('left', t('console.reports.waitlistReport.left'), (line) => line.leftList),
    duration('wait', t('console.reports.waitlistReport.wait'), (line) => line.waitSeconds),
    duration('longest', t('console.reports.waitlistReport.longest'), (line) => line.longestSeconds),
  ];
  return (
    <Stack gap={4}>
      <ReportFigures {...props} report="waitlist" />
      <ReportChart {...props} report="waitlist" />
      <ReportTable {...props} label={t('console.reports.waitlistReport.title')} lines={lines} columns={columns} rowKey={(line) => line.tableId}
        emptyText={t('console.reports.tables.empty')} />
    </Stack>
  );
}

const FNB_GROUPS = ['table', 'staff'] as const;

/** Food and drink: orders, items and the time to accept and to serve; then the same by table or by the staff member who accepted them. */
export function FnbReport(props: ReportProps) {
  const [by, setBy] = useState<FnbLine['groupedBy']>('table');
  const read = useFnbReport(spanOf(props));
  const lines = { ...read, data: read.data?.filter((line) => line.groupedBy === by) };
  const name = (line: FnbLine) => line.label ?? t('console.reports.fnbReport.nobody');
  const columns: readonly DataTableColumn<FnbLine>[] = [
    { key: 'name', header: t(`console.reports.fnbReport.${by}`), isWide: true, filter: 'text', sortValue: name, cell: name },
    count('orders', t('console.reports.fnbReport.orders'), (line) => line.orders),
    count('items', t('console.reports.fnbReport.items'), (line) => line.items),
    duration('accept', t('console.reports.fnbReport.accept'), (line) => line.acceptSeconds),
    duration('serve', t('console.reports.fnbReport.serve'), (line) => line.serveSeconds),
    count('voided', t('console.reports.fnbReport.voided'), (line) => line.voided),
  ];
  return (
    <Stack gap={4}>
      <ReportFigures {...props} report="fnb" />
      <ReportChart {...props} report="fnb" />
      <ChoiceChips label={t('console.reports.fnbReport.by')} isLabelVisuallyHidden mode="one" look="subtle" selected={[by]}
        options={FNB_GROUPS.map((value) => ({ value, label: t(`console.reports.fnbReport.by${value === 'table' ? 'Table' : 'Staff'}`) }))}
        onChange={([picked]) => setBy(FNB_GROUPS.find((value) => value === picked) ?? 'table')} />
      <ReportTable {...props} label={t('console.reports.fnbReport.title')} lines={lines} columns={columns} rowKey={(line) => `${line.groupedBy}:${line.label ?? ''}`}
        emptyText={t('console.reports.fnbReport.empty')} />
    </Stack>
  );
}

/** Bonus: what was given, how much of it by hand, what was used and what members hold; then what was given by promotion, by hand and by any other reason. */
export function BonusReport(props: ReportProps) {
  const lines = useBonusReport(spanOf(props));
  const source = (line: BonusLine) => (line.source === 'hand' ? t('console.reports.bonusReport.byHand') : line.label ?? '');
  const given = (line: BonusLine) => Number(formatRupeesForFile(line.given));
  const columns: readonly DataTableColumn<BonusLine>[] = [
    { key: 'source', header: t('console.reports.bonusReport.source'), isWide: true, filter: 'text', sortValue: source, cell: source },
    count('members', t('console.reports.bonusReport.members'), (line) => line.members),
    count('grants', t('console.reports.bonusReport.grants'), (line) => line.grants),
    { key: 'given', header: t('console.reports.bonusReport.given'), align: 'end', filter: 'number', sortValue: given, exportValue: given, cell: (line) => formatChips(line.given) },
  ];
  return (
    <Stack gap={4}>
      <ReportFigures {...props} report="bonus" />
      <ReportChart {...props} report="bonus" />
      <ReportTable {...props} label={t('console.reports.bonusReport.title')} lines={lines} columns={columns} rowKey={(line) => `${line.source}:${line.label ?? ''}`}
        emptyText={t('console.reports.bonusReport.empty')} />
      <BonusGivenList span={spanOf(props)} periodWords={props.period.words} />
    </Stack>
  );
}
