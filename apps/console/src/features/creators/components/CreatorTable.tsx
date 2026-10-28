import { useCreatorDashboard, type CreatorRow } from '@rivr/db/creators';
import { formatMoney, formatNumber, t } from '@rivr/i18n';
import { DataTable, Money, Stack, Text, type DataTableColumn } from '@rivr/ui';

const COLUMNS: readonly DataTableColumn<CreatorRow>[] = [
  { key: 'name', header: t('console.creators.name'), sortValue: (row) => row.name, cell: (row) => row.name },
  { key: 'link', header: t('console.creators.link'), cell: (row) => t('console.creators.linkValue', { code: row.code }) },
  { key: 'commission', header: t('console.creators.commission'),
    cell: (row) => t('console.creators.commissionValue', { amount: formatMoney(row.commission), basis: t(`console.creators.bases.${row.basis}`) }) },
  { key: 'signedUp', header: t('console.creators.signedUp'), align: 'end', sortValue: (row) => row.signedUp, cell: (row) => formatNumber(row.signedUp) },
  { key: 'kycDone', header: t('console.creators.kycDone'), align: 'end', sortValue: (row) => row.kycDone, cell: (row) => formatNumber(row.kycDone) },
  { key: 'visited', header: t('console.creators.visited'), align: 'end', sortValue: (row) => row.visited, cell: (row) => formatNumber(row.visited) },
  { key: 'boughtIn', header: t('console.creators.boughtIn'), align: 'end', sortValue: (row) => row.boughtIn, cell: (row) => formatNumber(row.boughtIn) },
  { key: 'owed', header: t('console.creators.owed'), align: 'end', sortValue: (row) => row.owed, cell: (row) => <Money paise={row.owed} /> },
];

/** Each creator's dashboard (#163): their link, their sign-ups at each stage, and what their commission comes to. */
export function CreatorTable({ venueId }: { venueId: string }) {
  const dashboard = useCreatorDashboard(venueId);
  const base = { label: t('console.creators.table'), columns: COLUMNS, rowKey: (row: CreatorRow) => row.creatorId };
  return (
    <Stack gap={4}>
      <Text variant="small" tone="muted">{t('console.creators.hint')}</Text>
      {dashboard.data === undefined && dashboard.isError ? <DataTable {...base} status="error" onRetry={() => void dashboard.refetch()} /> : null}
      {dashboard.data === undefined && !dashboard.isError ? <DataTable {...base} status="loading" /> : null}
      {dashboard.data === undefined ? null : <DataTable {...base} rows={dashboard.data} emptyText={t('console.creators.none')} />}
    </Stack>
  );
}
