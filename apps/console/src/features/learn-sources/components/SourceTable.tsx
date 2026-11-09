import type { LearnSource } from '@rivr/db/learnSources';
import { formatDate, formatIsoDay, t } from '@rivr/i18n';
import { DataTable, type DataTableColumn } from '@rivr/ui';

/** Today in IST, as a licence's last day is kept. */
const today = () => formatIsoDay(new Date());

/** The table's columns, made when it draws, so t() runs once the app's words are registered, as columns() does elsewhere (F2-31). */
function columns(): readonly DataTableColumn<LearnSource>[] {
  return [
    { key: 'title', header: t('console.learnSources.sourceTitle'), sortValue: (row) => row.title, cell: (row) => row.title, filter: 'text' },
    { key: 'key', header: t('console.learnSources.key'), cell: (row) => row.sourceKey },
    { key: 'ends', header: t('console.learnSources.licenceEnds'), sortValue: (row) => row.licenceEndsOn, cell: (row) => formatDate(new Date(row.licenceEndsOn)) },
    { key: 'status', header: t('console.learnSources.status'), filter: 'choice',
      cell: (row) => t(row.licenceEndsOn >= today() ? 'console.learnSources.active' : 'console.learnSources.lapsed') },
  ];
}

/** The venue's sources with their licences: on until the last day, then off for everyone. */
export function SourceTable({ rows, exportIn }: { rows: readonly LearnSource[]; exportIn: HTMLElement | null }) {
  return <DataTable exportIn={exportIn} label={t('console.learnSources.table')} columns={columns()} rowKey={(row) => row.sourceKey} rows={rows} emptyText={t('console.learnSources.none')} />;
}
