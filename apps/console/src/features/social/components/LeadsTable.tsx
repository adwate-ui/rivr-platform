import { useLeads, type Lead } from '@rivr/db/social';
import { formatDayTime, formatNumber, t } from '@rivr/i18n';
import { DataTable, Heading, Stack, Text, type DataTableColumn } from '@rivr/ui';

const COLUMNS: readonly DataTableColumn<Lead>[] = [
  { key: 'channel', header: t('console.social.leads.channel'), cell: (row) => t(`console.social.leads.channels.${row.channel}`) },
  { key: 'handle', header: t('console.social.leads.handle'), cell: (row) => row.handle },
  { key: 'first', header: t('console.social.leads.firstMessage'), cell: (row) => row.firstMessage },
  { key: 'last', header: t('console.social.leads.lastMessage'), sortValue: (row) => row.lastMessageAt, cell: (row) => formatDayTime(new Date(row.lastMessageAt)) },
  { key: 'messages', header: t('console.social.leads.messages'), align: 'end', sortValue: (row) => row.messages, cell: (row) => formatNumber(row.messages) },
  { key: 'member', header: t('console.social.leads.member'), cell: (row) => row.memberName ?? t('console.social.leads.notMember') },
];

/** Leads from the social inbox (#156): each conversation on Instagram, Facebook or WhatsApp, and the member it became. */
export function LeadsTable({ venueId }: { venueId: string }) {
  const leads = useLeads(venueId);
  const base = { label: t('console.social.leads.table'), columns: COLUMNS, rowKey: (row: Lead) => row.leadId };
  return (
    <Stack gap={4}>
      <Heading level={2} variant="section">{t('console.social.leads.title')}</Heading>
      <Text variant="small" tone="muted">{t('console.social.leads.hint')}</Text>
      {leads.data === undefined && leads.isError ? <DataTable {...base} status="error" onRetry={() => void leads.refetch()} /> : null}
      {leads.data === undefined && !leads.isError ? <DataTable {...base} status="loading" /> : null}
      {leads.data === undefined ? null : <DataTable {...base} rows={leads.data} emptyText={t('console.social.leads.none')} />}
    </Stack>
  );
}
