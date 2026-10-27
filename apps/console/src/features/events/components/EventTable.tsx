import { useVenueClubEvents, type VenueClubEvent } from '@rivr/db/clubEvents';
import { formatDayTime, t } from '@rivr/i18n';
import { DataTable, type DataTableColumn } from '@rivr/ui';

const COLUMNS: readonly DataTableColumn<VenueClubEvent>[] = [
  { key: 'when', header: t('console.events.when'), sortValue: (row) => row.startsAt, cell: (row) => formatDayTime(new Date(row.startsAt)) },
  { key: 'kind', header: t('console.events.kind'), cell: (row) => t(`console.events.kinds.${row.kind}`) },
  { key: 'title', header: t('console.events.eventTitle'), cell: (row) => row.title },
  { key: 'booked', header: t('console.events.booked'), align: 'end', sortValue: (row) => row.booked,
    cell: (row) => t('console.events.bookedValue', { booked: row.booked, seats: row.seats }) },
];

/** The venue's events from twelve hours ago on (#143), soonest first, with how many have booked. */
export function EventTable({ venueId }: { venueId: string }) {
  const events = useVenueClubEvents(venueId);
  const base = { label: t('console.events.table'), columns: COLUMNS, rowKey: (row: VenueClubEvent) => row.eventId };
  if (events.data === undefined && events.isError) return <DataTable {...base} status="error" onRetry={() => void events.refetch()} />;
  if (events.data === undefined) return <DataTable {...base} status="loading" />;
  return <DataTable {...base} rows={events.data} emptyText={t('console.events.none')} />;
}
