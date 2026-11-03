import { useLeads, type Lead } from '@rivr/db/social';
import { formatDayTime, formatNumber, t } from '@rivr/i18n';
import { DataTable, type DataTableColumn } from '@rivr/ui';

/** The table's columns, made when it draws, so t() runs once the app's words are registered, as columns() does elsewhere (F2-31). */
function columns(): readonly DataTableColumn<Lead>[] {
  return [
    { key: 'channel', header: t('console.social.leads.channel'), cell: (row) => t(`console.social.leads.channels.${row.channel}`) },
    { key: 'handle', header: t('console.social.leads.handle'), cell: (row) => row.handle },
    { key: 'first', header: t('console.social.leads.firstMessage'), cell: (row) => row.firstMessage },
    { key: 'last', header: t('console.social.leads.lastMessage'), sortValue: (row) => row.lastMessageAt, cell: (row) => formatDayTime(new Date(row.lastMessageAt)) },
    { key: 'messages', header: t('console.social.leads.messages'), align: 'end', sortValue: (row) => row.messages, cell: (row) => formatNumber(row.messages) },
    { key: 'member', header: t('console.social.leads.member'), cell: (row) => row.memberName ?? t('console.social.leads.notMember') },
  ];
}

/** Leads from the social inbox (#587): each conversation on Instagram, Facebook or WhatsApp, and the member it became. */
export function LeadsTable({ venueId }: { venueId: string }) {
  const leads = useLeads(venueId);
  const base = { label: t('console.social.leads.table'), columns: columns(), rowKey: (row: Lead) => row.leadId };
  if (leads.data === undefined && leads.isError) return <DataTable {...base} status="error" onRetry={() => void leads.refetch()} />;
  if (leads.data === undefined) return <DataTable {...base} status="loading" />;
  return <DataTable {...base} rows={leads.data} emptyText={t('console.social.leads.none')} narrowLayout="scroll" />;
}
