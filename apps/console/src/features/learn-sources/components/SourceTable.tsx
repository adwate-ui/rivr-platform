import { useLearnSources, type LearnSource } from '@rivr/db/learnSources';
import { formatDate, t } from '@rivr/i18n';
import { DataTable, type DataTableColumn } from '@rivr/ui';

/** Today in IST, as a licence's last day is kept. */
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

const COLUMNS: readonly DataTableColumn<LearnSource>[] = [
  { key: 'title', header: t('console.learnSources.sourceTitle'), sortValue: (row) => row.title, cell: (row) => row.title },
  { key: 'key', header: t('console.learnSources.key'), cell: (row) => row.sourceKey },
  { key: 'ends', header: t('console.learnSources.licenceEnds'), sortValue: (row) => row.licenceEndsOn, cell: (row) => formatDate(new Date(row.licenceEndsOn)) },
  { key: 'status', header: t('console.learnSources.status'),
    cell: (row) => t(row.licenceEndsOn >= today() ? 'console.learnSources.active' : 'console.learnSources.lapsed') },
];

/** The venue's sources with their licences: on until the last day, then off for everyone. */
export function SourceTable({ venueId }: { venueId: string }) {
  const sources = useLearnSources(venueId);
  const base = { label: t('console.learnSources.table'), columns: COLUMNS, rowKey: (row: LearnSource) => row.sourceKey };
  if (sources.data === undefined && sources.isError) return <DataTable {...base} status="error" onRetry={() => void sources.refetch()} />;
  if (sources.data === undefined) return <DataTable {...base} status="loading" />;
  return <DataTable {...base} rows={sources.data} emptyText={t('console.learnSources.none')} />;
}
