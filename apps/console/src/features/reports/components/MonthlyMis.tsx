import { useMisReport, type AccountLine, type MisReport } from '@rivr/db/reports';
import { clubDay } from '@rivr/domain/clubDay';
import type { Paise } from '@rivr/domain/money';
import { formatDayTime, formatMonth, formatNumber, t } from '@rivr/i18n';
import { ChoiceChips, DataTable, Grid, Heading, Money, Stack, Text, type DataTableColumn } from '@rivr/ui';
import { useState } from 'react';
import { RakeTable } from './RakeTable.tsx';

/** The first days of the last six club months, this one first, from a club day (`2026-10-26`). */
export function recentMonths(today: string): string[] {
  const [year = 0, month = 1] = today.split('-').map(Number);
  return [0, 1, 2, 3, 4, 5].map((back) => {
    const first = new Date(Date.UTC(year, month - 1 - back, 1));
    return `${first.getUTCFullYear()}-${String(first.getUTCMonth() + 1).padStart(2, '0')}-01`;
  });
}

/** One of the month's figures: a count or an amount. */
interface Figure {
  readonly key: 'hands' | 'rake' | 'drop' | 'revenue' | 'expenses' | 'net' | 'visits' | 'members';
  readonly count?: number;
  readonly amount?: Paise;
}

function figures(mis: MisReport): Figure[] {
  return [
    { key: 'hands', count: mis.hands }, { key: 'rake', amount: mis.rake }, { key: 'drop', amount: mis.drop },
    { key: 'revenue', amount: mis.totalRevenue }, { key: 'expenses', amount: mis.totalExpenses }, { key: 'net', amount: mis.net },
    { key: 'visits', count: mis.visits }, { key: 'members', count: mis.members },
  ];
}

const figureColumns = (): readonly DataTableColumn<Figure>[] => [
  { key: 'figure', header: t('console.reports.figure'), cell: (row) => t(`console.reports.figureNames.${row.key}`) },
  { key: 'value', header: t('console.reports.value'), align: 'end', cell: (row) => (row.amount === undefined ? formatNumber(row.count ?? 0) : <Money paise={row.amount} />) },
];

const accountColumns = (): readonly DataTableColumn<AccountLine>[] => [
  { key: 'account', header: t('console.reports.account'), cell: (row) => row.name, sortValue: (row) => row.name },
  { key: 'amount', header: t('console.reports.amount'), align: 'end', sortValue: (row) => row.amount, cell: (row) => <Money paise={row.amount} /> },
];

/** The month's tables: its figures, revenue and expenses by account, and rake by table, dealer and game. */
function MisTables({ mis }: { mis: MisReport }) {
  const rake = { isError: false, onRetry: () => undefined, emptyText: t('console.reports.noHandsMonth') };
  const accounts = (label: string, lines: readonly AccountLine[], emptyText: string) => (
    <DataTable label={label} columns={accountColumns()} rowKey={(row) => row.code} rows={lines} emptyText={emptyText} />
  );
  return (
    <Grid columns={3} gap={6}>
      <DataTable label={t('console.reports.figures')} columns={figureColumns()} rowKey={(row) => row.key} rows={figures(mis)} emptyText="" />
      {accounts(t('console.reports.revenue'), mis.revenue, t('console.reports.noRevenue'))}
      {accounts(t('console.reports.expenses'), mis.expenses, t('console.reports.noExpenses'))}
      <RakeTable {...rake} label={t('console.reports.monthByTable')} nameHeader={t('console.reports.table')} rows={mis.byTable} />
      <RakeTable {...rake} label={t('console.reports.monthByDealer')} nameHeader={t('console.reports.dealer')} rows={mis.byDealer} />
      <RakeTable {...rake} label={t('console.reports.monthByVariant')} nameHeader={t('console.reports.variant')} rows={mis.byVariant} />
    </Grid>
  );
}

/** Whether a month's MIS is stored, the month so far, or a past month never stored. */
function statusLine(mis: MisReport, isThisMonth: boolean): string {
  if (mis.generatedAt !== null) return t('console.reports.stored', { at: formatDayTime(new Date(mis.generatedAt)) });
  return t(isThisMonth ? 'console.reports.preview' : 'console.reports.notStored', { month: formatMonth(mis.month) });
}

/** A month's MIS: whether it is stored or a preview, then its tables; or the figures' loading or error state. */
function MisBody({ venueId, month, isThisMonth }: { venueId: string; month: string; isThisMonth: boolean }) {
  const mis = useMisReport(venueId, month);
  const base = { label: t('console.reports.figures'), columns: figureColumns(), rowKey: (row: Figure) => row.key };
  if (mis.data === undefined && mis.isError) return <DataTable {...base} status="error" onRetry={() => void mis.refetch()} />;
  if (mis.data === undefined) return <DataTable {...base} status="loading" />;
  return (
    <Stack gap={4}>
      <Text>{statusLine(mis.data, isThisMonth)}</Text>
      <MisTables mis={mis.data} />
    </Stack>
  );
}

/** The monthly investor MIS (#99): one of the last six club months, as stored on the 1st or as a preview. */
export function MonthlyMis({ venueId }: { venueId: string }) {
  const [months] = useState(() => recentMonths(clubDay(new Date())));
  const [month, setMonth] = useState(months[0] ?? '');
  return (
    <Stack gap={4}>
      <Heading level={2}>{t('console.reports.mis')}</Heading>
      <Text variant="small" tone="muted">{t('console.reports.misHint')}</Text>
      <ChoiceChips label={t('console.reports.month')} mode="one" selected={[month]}
        options={months.map((first) => ({ value: first, label: formatMonth(first) }))} onChange={(picked) => setMonth(picked[0] ?? month)} />
      {month === '' ? null : <MisBody venueId={venueId} month={month} isThisMonth={month === months[0]} />}
    </Stack>
  );
}
