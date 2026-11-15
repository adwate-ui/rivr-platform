import { TOP_UP_HISTORY_PAGE, useTopUpHistory, type PastTopUp } from '@rivr/db';
import { clubDay } from '@rivr/domain/clubDay';
import { formatMinutesSeconds, formatTime, t } from '@rivr/i18n';
import { DataTable, Heading, Inline, Input, Stack, type DataTableColumn } from '@rivr/ui';
import { useState } from 'react';

/** A step's length in minutes and seconds, as the wait beside a request counts (`1:15`), or a dash where the step was never taken. */
const lengthOf = (seconds: number | null) => (seconds === null ? t('console.topUps.none') : formatMinutesSeconds(seconds));
const nameOf = (name: string | null) => name ?? t('console.topUps.none');

/**
 * A day's requests as a table: where and who, when they asked, who accepted and who marked it done, and how long each step
 * took. The day is its one filter, so no column has a menu; on a phone each request is a card.
 */
const columns = (): readonly DataTableColumn<PastTopUp>[] => [
  { filter: false, key: 'where', header: t('console.topUps.columns.where'), priority: 'primary', cell: (row) => t('console.topUps.where', { table: row.tableName, seat: row.seat }) },
  { filter: false, key: 'member', header: t('console.topUps.columns.member'), cell: (row) => row.fullName },
  { filter: false, key: 'asked', header: t('console.topUps.columns.asked'), cell: (row) => formatTime(new Date(row.requestedAt)) },
  { filter: false, key: 'acceptedBy', header: t('console.topUps.columns.acceptedBy'), cell: (row) => nameOf(row.acceptedBy) },
  { filter: false, key: 'accepted', header: t('console.topUps.columns.accepted'), align: 'end', cell: (row) => lengthOf(row.acceptedSeconds) },
  { filter: false, key: 'doneBy', header: t('console.topUps.columns.doneBy'), cell: (row) => nameOf(row.doneBy) },
  { filter: false, key: 'done', header: t('console.topUps.columns.done'), align: 'end', cell: (row) => lengthOf(row.doneSeconds) },
  { filter: false, key: 'status', header: t('console.topUps.columns.status'), cell: (row) => t(`console.topUps.statusShort.${row.status}`) },
];

/**
 * Past requests, a club day at a time (redesign RD-32): the day is chosen, today's at first, and its requests come a
 * page at a time from the server, the newest first. Each says who accepted it, who marked it done and how long each
 * step took.
 */
export function PastTopUps({ venueId }: { venueId: string }) {
  const [day, setDay] = useState(() => clubDay(new Date()));
  const [page, setPage] = useState(1);
  const history = useTopUpHistory(venueId, day, page);
  const base = {
    label: t('console.topUps.pastLabel'), columns: columns(), rowKey: (row: PastTopUp) => row.requestId,
    server: { total: history.data?.total ?? 0, pageSize: TOP_UP_HISTORY_PAGE, scope: day, onRequest: (request: { page: number }) => setPage(request.page) },
  };
  const state = history.data === undefined
    ? (history.isError ? { status: 'error' as const, onRetry: () => void history.refetch() } : { status: 'loading' as const })
    : { rows: history.data.rows, emptyText: t('console.topUps.nonePast') };
  return (
    <Stack gap={3}>
      <Heading level={2}>{t('console.topUps.past')}</Heading>
      <Inline>
        <Input type="date" label={t('console.topUps.day')} value={day}
          onChange={(event) => { if (event.target.value !== '') { setDay(event.target.value); setPage(1); } }} />
      </Inline>
      <DataTable {...base} {...state} />
    </Stack>
  );
}
