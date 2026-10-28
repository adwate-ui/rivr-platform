import type { SiteRevision } from '@rivr/db/siteEditor';
import { formatDayTime, t } from '@rivr/i18n';
import { Button, DataTable, Heading, Stack, type DataTableColumn } from '@rivr/ui';

/** When a version went up, or is due, or was made. */
const whenOf = (revision: SiteRevision) => revision.publishedAt ?? revision.publishAt ?? revision.createdAt;

/** A page's versions, newest first (#129): each published one can be published again in one click. */
export function RevisionHistory({ revisions, onRestore }: { revisions: readonly SiteRevision[]; onRestore: (revision: SiteRevision) => void }) {
  const columns: readonly DataTableColumn<SiteRevision>[] = [
    { key: 'when', header: t('console.website.history.when'), cell: (row) => formatDayTime(new Date(whenOf(row))) },
    { key: 'status', header: t('console.website.history.status'), cell: (row) => t(`console.website.history.statuses.${row.status}`) },
    { key: 'restore', header: t('console.website.history.restore'), align: 'end', cell: (row) => (row.status === 'replaced' ? (
      <Button variant="text" onClick={() => onRestore(row)} aria-label={t('console.website.history.restoreName', { when: formatDayTime(new Date(whenOf(row))) })}>
        {t('console.website.history.restore')}
      </Button>
    ) : null) },
  ];
  return (
    <Stack gap={4}>
      <Heading level={2} variant="section">{t('console.website.history.title')}</Heading>
      <DataTable label={t('console.website.history.title')} columns={columns} rowKey={(row) => row.revisionId} rows={[...revisions]} emptyText={t('console.website.history.none')} />
    </Stack>
  );
}
