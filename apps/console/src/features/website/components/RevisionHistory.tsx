import type { SiteRevision } from '@rivr/db/siteEditor';
import { formatDayTime, t } from '@rivr/i18n';
import { ConfirmButton, DataTable, Heading, Stack, type DataTableColumn } from '@rivr/ui';

/** When a version went up, or is due, or was made. */
const whenOf = (revision: SiteRevision) => revision.publishedAt ?? revision.publishAt ?? revision.createdAt;

/** A page's versions, newest first (#129): each published one can be published again, asked twice as it goes live at once (F2-21). */
export function RevisionHistory({ revisions, onRestore }: { revisions: readonly SiteRevision[]; onRestore: (revision: SiteRevision) => void }) {
  const columns: readonly DataTableColumn<SiteRevision>[] = [
    { key: 'when', header: t('console.website.history.when'), cell: (row) => formatDayTime(new Date(whenOf(row))) },
    { key: 'status', header: t('console.website.history.status'), cell: (row) => t(`console.website.history.statuses.${row.status}`), filter: 'choice' },
    { key: 'restore', filter: false, header: t('console.website.history.restore'), align: 'end', cell: (row) => (row.status === 'replaced' ? (
      <ConfirmButton label={t('console.website.history.restore')} name={t('console.website.history.restoreName', { when: formatDayTime(new Date(whenOf(row))) })}
        confirm={t('console.website.history.confirmRestore')} onConfirm={() => onRestore(row)} />
    ) : null) },
  ];
  return (
    <Stack gap={4}>
      <Heading level={3} variant="subsection">{t('console.website.history.title')}</Heading>
      <DataTable label={t('console.website.history.title')} columns={columns} rowKey={(row) => row.revisionId} rows={[...revisions]} emptyText={t('console.website.history.none')} />
    </Stack>
  );
}
