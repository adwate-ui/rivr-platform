import { useUnclaimedBalances, type UnclaimedBalance } from '@rivr/db/reports';
import { formatDate, formatNumber, t } from '@rivr/i18n';
import { DataTable, Heading, Money, Stack, Text, type DataTableColumn } from '@rivr/ui';

const COLUMNS: readonly DataTableColumn<UnclaimedBalance>[] = [
  { key: 'number', header: t('console.reports.memberNumber'), align: 'end', sortValue: (row) => row.memberNumber, cell: (row) => formatNumber(row.memberNumber) },
  { key: 'member', header: t('console.reports.member'), sortValue: (row) => row.fullName, cell: (row) => row.fullName },
  { key: 'cash', header: t('console.reports.cash'), align: 'end', sortValue: (row) => row.cash, cell: (row) => <Money paise={row.cash} /> },
  { key: 'bonus', header: t('console.reports.bonus'), align: 'end', sortValue: (row) => row.bonus, cell: (row) => <Money paise={row.bonus} /> },
  { key: 'lastSeen', header: t('console.reports.lastSeen'), sortValue: (row) => row.lastSeenAt, cell: (row) => formatDate(new Date(row.lastSeenAt)) },
];

/** Unclaimed balances (#110): members holding cash or bonus untouched for the venue's period, the quietest first. */
export function UnclaimedBalances({ venueId }: { venueId: string }) {
  const unclaimed = useUnclaimedBalances(venueId);
  const base = { label: t('console.reports.unclaimedTable'), columns: COLUMNS, rowKey: (row: UnclaimedBalance) => row.memberId };
  return (
    <Stack gap={4}>
      <Heading level={2}>{t('console.reports.unclaimed')}</Heading>
      <Text variant="small" tone="muted">{t('console.reports.unclaimedHint')}</Text>
      {unclaimed.data === undefined && unclaimed.isError ? <DataTable {...base} status="error" onRetry={() => void unclaimed.refetch()} /> : null}
      {unclaimed.data === undefined && !unclaimed.isError ? <DataTable {...base} status="loading" /> : null}
      {unclaimed.data === undefined ? null : (
        <DataTable {...base} rows={unclaimed.data} emptyText={t('console.reports.noUnclaimed')} initialSort={{ key: 'lastSeen', direction: 'ascending' }} />
      )}
    </Stack>
  );
}
