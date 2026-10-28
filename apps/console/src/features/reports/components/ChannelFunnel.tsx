import { useChannelFunnel, type ChannelRow } from '@rivr/db/reports';
import { formatNumber, t } from '@rivr/i18n';
import { DataTable, Heading, Stack, Text, type DataTableColumn } from '@rivr/ui';

const channelName = (row: ChannelRow) => t(`console.social.channels.${row.channel}`);

/** A count, or that the channel has not been counted. */
const count = (value: number | null) => (value === null ? t('console.reports.notCounted') : formatNumber(value));

/** The followers gained (or lost) over the 30 days before the latest count. */
function change(row: ChannelRow): string {
  if (row.followers === null || row.followers30DaysAgo === null) return t('console.reports.notCounted');
  const gained = row.followers - row.followers30DaysAgo;
  return gained > 0 ? `+${formatNumber(gained)}` : formatNumber(gained);
}

const COLUMNS: readonly DataTableColumn<ChannelRow>[] = [
  { key: 'channel', header: t('console.reports.channel'), sortValue: channelName, cell: channelName },
  { key: 'followers', header: t('console.reports.followers'), align: 'end', sortValue: (row) => row.followers ?? -1, cell: (row) => count(row.followers) },
  { key: 'change', header: t('console.reports.followersChange'), align: 'end', cell: change },
  { key: 'signedUp', header: t('console.reports.signedUpFromLinks'), align: 'end', sortValue: (row) => row.signedUp, cell: (row) => formatNumber(row.signedUp) },
  { key: 'kycDone', header: t('console.reports.kycDone'), align: 'end', sortValue: (row) => row.kycDone, cell: (row) => formatNumber(row.kycDone) },
  { key: 'boughtIn', header: t('console.reports.boughtIn'), align: 'end', sortValue: (row) => row.boughtIn, cell: (row) => formatNumber(row.boughtIn) },
];

/** Channel analytics (#164): each channel's followers, counted nightly, beside the members who signed up from its links. */
export function ChannelFunnel({ venueId }: { venueId: string }) {
  const channels = useChannelFunnel(venueId);
  const base = { label: t('console.reports.channelsTable'), columns: COLUMNS, rowKey: (row: ChannelRow) => row.channel };
  return (
    <Stack gap={4}>
      <Heading level={2}>{t('console.reports.channels')}</Heading>
      <Text variant="small" tone="muted">{t('console.reports.channelsHint')}</Text>
      {channels.data === undefined && channels.isError ? <DataTable {...base} status="error" onRetry={() => void channels.refetch()} /> : null}
      {channels.data === undefined && !channels.isError ? <DataTable {...base} status="loading" /> : null}
      {channels.data === undefined ? null : <DataTable {...base} rows={channels.data} emptyText={t('console.reports.notCounted')} />}
    </Stack>
  );
}
