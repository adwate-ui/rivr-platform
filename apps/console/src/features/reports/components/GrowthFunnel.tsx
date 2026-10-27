import { useGrowthFunnel, type FunnelRow } from '@rivr/db/reports';
import { formatNumber, t } from '@rivr/i18n';
import { DataTable, Heading, Stack, Text, type DataTableColumn } from '@rivr/ui';

/** Where a source's members came from, as its row reads. */
function sourceName(row: FunnelRow): string {
  return t(`console.reports.sources.${row.sourceKind}`, { code: row.sourceCode ?? '' });
}

/** A stage's count and its share of the source's sign-ups, rounded down. */
function stage(count: number, row: FunnelRow): string {
  return t('console.reports.stage', { count: formatNumber(count), percent: String(Math.floor((count * 100) / row.signedUp)) });
}

const COLUMNS: readonly DataTableColumn<FunnelRow>[] = [
  { key: 'source', header: t('console.reports.source'), sortValue: sourceName, cell: sourceName },
  { key: 'signedUp', header: t('console.reports.signedUp'), align: 'end', sortValue: (row) => row.signedUp, cell: (row) => formatNumber(row.signedUp) },
  { key: 'kycDone', header: t('console.reports.kycDone'), align: 'end', sortValue: (row) => row.kycDone, cell: (row) => stage(row.kycDone, row) },
  { key: 'visited', header: t('console.reports.visited'), align: 'end', sortValue: (row) => row.visited, cell: (row) => stage(row.visited, row) },
  { key: 'boughtIn', header: t('console.reports.boughtIn'), align: 'end', sortValue: (row) => row.boughtIn, cell: (row) => stage(row.boughtIn, row) },
];

/** The growth funnel (#166; S-G3): sign-up, KYC, a first visit and a first buy-in by source, from our own data. */
export function GrowthFunnel({ venueId }: { venueId: string }) {
  const funnel = useGrowthFunnel(venueId);
  const base = { label: t('console.reports.funnelTable'), columns: COLUMNS, rowKey: (row: FunnelRow) => `${row.sourceKind}:${row.sourceCode ?? ''}` };
  return (
    <Stack gap={4}>
      <Heading level={2}>{t('console.reports.funnel')}</Heading>
      <Text variant="small" tone="muted">{t('console.reports.funnelHint')}</Text>
      {funnel.data === undefined && funnel.isError ? <DataTable {...base} status="error" onRetry={() => void funnel.refetch()} /> : null}
      {funnel.data === undefined && !funnel.isError ? <DataTable {...base} status="loading" /> : null}
      {funnel.data === undefined ? null : <DataTable {...base} rows={funnel.data} emptyText={t('console.reports.noFunnel')} />}
    </Stack>
  );
}
