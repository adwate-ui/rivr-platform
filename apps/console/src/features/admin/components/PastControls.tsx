import { usePastControls, type PastControl } from '@rivr/db';
import { formatDayTime, formatList, t } from '@rivr/i18n';
import { DataTable, Heading, Stack, type DataTableColumn } from '@rivr/ui';
import { controlName } from './controlCopy.ts';

const at = (moment: string) => formatDayTime(new Date(moment));

function columns(): readonly DataTableColumn<PastControl>[] {
  const engaged = (row: PastControl) => at(row.engagedAt);
  const released = (row: PastControl) => at(row.releasedAt);
  const releasedBy = (row: PastControl) => formatList([row.releasedBy, row.releaseSecond].filter((name) => name !== null));
  return [
    { key: 'control', header: t('console.killSwitch.past.control'), cell: controlName, exportValue: controlName, sortValue: controlName, isWide: true },
    { key: 'engaged', header: t('console.killSwitch.past.engaged'), cell: engaged, exportValue: engaged, sortValue: (row) => row.engagedAt, filter: 'date' },
    { key: 'engagedBy', header: t('console.killSwitch.past.engagedBy'), cell: (row) => row.engagedBy ?? '', sortValue: (row) => row.engagedBy ?? '' },
    { key: 'why', header: t('console.killSwitch.past.why'), cell: (row) => row.reason, isWide: true },
    { key: 'released', header: t('console.killSwitch.past.released'), cell: released, exportValue: released, sortValue: (row) => row.releasedAt, filter: 'date' },
    { key: 'releasedBy', header: t('console.killSwitch.past.releasedBy'), cell: releasedBy, exportValue: releasedBy, sortValue: releasedBy },
    { key: 'releaseWhy', header: t('console.killSwitch.past.releaseWhy'), cell: (row) => row.releaseReason ?? '', isWide: true },
  ];
}

/** Past controls (8 Nov audit, F-034): what has been released, latest first, engaged and released by whom and why. */
export function PastControls({ venueId }: { venueId: string }) {
  const past = usePastControls(venueId);
  const base = { label: t('console.killSwitch.past.title'), columns: columns(), rowKey: (row: PastControl) => row.controlId, narrowLayout: 'scroll' as const };
  return (
    <Stack gap={4}>
      <Heading level={2}>{t('console.killSwitch.past.title')}</Heading>
      {past.isError ? <DataTable {...base} status="error" onRetry={() => void past.refetch()} />
        : past.data === undefined ? <DataTable {...base} status="loading" />
        : <DataTable {...base} rows={past.data} emptyText={t('console.killSwitch.past.empty')} />}
    </Stack>
  );
}
