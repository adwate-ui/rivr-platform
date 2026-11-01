import { useStaffVenue, useTodaysPlayers, type TodayStatus, type TodaysPlayer } from '@rivr/db';
import { formatDuration, formatTime, t } from '@rivr/i18n';
import { DataTable, Screen, type DataTableColumn } from '@rivr/ui';

// Who needs the floor first: those waiting, then those playing, then those who left.
const RANK: Readonly<Record<TodayStatus, number>> = { waiting: 0, playing: 1, left: 2 };

const at = (iso: string | null) => (iso === null ? t('console.todaysPlayers.none') : formatTime(new Date(iso)));

const COLUMNS: readonly DataTableColumn<TodaysPlayer>[] = [
  { key: 'name', header: t('console.todaysPlayers.name'), cell: (player) => player.fullName, sortValue: (player) => player.fullName, priority: 'primary' },
  { key: 'status', header: t('console.todaysPlayers.status'), cell: (player) => t(`console.todaysPlayers.statuses.${player.status}`), sortValue: (player) => RANK[player.status] },
  { key: 'in', header: t('console.todaysPlayers.checkedIn'), cell: (player) => at(player.checkedInAt), sortValue: (player) => player.checkedInAt ?? '' },
  { key: 'out', header: t('console.todaysPlayers.checkedOut'), cell: (player) => at(player.checkedOutAt), sortValue: (player) => player.checkedOutAt ?? '' },
  { key: 'waited', header: t('console.todaysPlayers.waited'), cell: (player) => formatDuration(player.waitingSeconds), sortValue: (player) => player.waitingSeconds, align: 'end' },
  {
    key: 'tables', header: t('console.todaysPlayers.tables'), priority: 'secondary',
    cell: (player) => (player.tables.length === 0 ? t('console.todaysPlayers.none')
      : player.tables.map((entry) => t('console.todaysPlayers.tableLine', { table: entry.table, time: formatDuration(entry.seconds) })).join(', ')),
  },
];

/**
 * Today's players (#641), for staff who read members: everyone at the club this club day, with their status, when they
 * checked in and out, how long they waited, and the tables they played on with the time on each.
 */
export function TodaysPlayersScreen() {
  const staff = useStaffVenue();
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  if (!staff.venue.permissions.includes('members.read')) {
    return <Screen title={t('console.todaysPlayers.title')} status="error" errorText={t('console.todaysPlayers.notAllowed')} />;
  }
  return <Players venueId={staff.venue.venueId} />;
}

function Players({ venueId }: { venueId: string }) {
  const players = useTodaysPlayers(venueId);
  const table = { label: t('console.todaysPlayers.label'), columns: COLUMNS, rowKey: (player: TodaysPlayer) => player.memberId };
  return (
    <Screen title={t('console.todaysPlayers.title')}>
      {players.data === undefined ? (
        players.isError ? <DataTable {...table} status="error" onRetry={() => void players.refetch()} /> : <DataTable {...table} status="loading" />
      ) : (
        <DataTable {...table} rows={players.data} emptyText={t('console.todaysPlayers.empty')}
          filter={{ label: t('console.todaysPlayers.filter'), text: (player) => player.fullName }} initialSort={{ key: 'status', direction: 'ascending' }} />
      )}
    </Screen>
  );
}
