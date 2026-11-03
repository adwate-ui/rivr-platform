import { useStaffVenue, useTodaysPlayers, type TodaysPlayer } from '@rivr/db';
import { t } from '@rivr/i18n';
import { ChoiceChips, DataTable, Screen, Stack } from '@rivr/ui';
import { useState } from 'react';
import { TODAYS_PLAYERS_COLUMNS } from './todaysPlayersColumns.tsx';

const FILTERS = ['all', 'playing', 'waiting', 'left'] as const;
type Filter = (typeof FILTERS)[number];

const shownBy = (players: readonly TodaysPlayer[], filter: Filter) => (filter === 'all' ? players : players.filter((player) => player.status === filter));

/**
 * Today's players (#641), for staff who read members: everyone at the club this club day, filtered by status with a
 * count on each (console v3), with when they checked in and out, how long they waited, their tables and the time played.
 */
export function TodaysPlayersTab() {
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
  const [filter, setFilter] = useState<Filter>('all');
  const title = t('console.todaysPlayers.title');
  if (players.data === undefined) {
    return players.isError
      ? <Screen title={title} status="error" onRetry={() => void players.refetch()} />
      : <Screen title={title} status="loading" loadingLook="rows" />;
  }
  if (players.data.length === 0) return <Screen title={title} status="empty" emptyText={t('console.todaysPlayers.empty')} />;
  const all = players.data;
  const label = (id: Filter) => t(id === 'all' ? 'console.todaysPlayers.all' : `console.todaysPlayers.statuses.${id}`);
  return (
    <Screen title={title}>
      <Stack gap={4}>
        <ChoiceChips look="subtle" mode="one" isOneRow isLabelVisuallyHidden label={t('console.todaysPlayers.status')} selected={[filter]}
          options={FILTERS.map((id) => ({ value: id, label: label(id), count: shownBy(all, id).length }))}
          onChange={([chosen]) => setFilter(FILTERS.find((id) => id === chosen) ?? 'all')} />
        <DataTable label={t('console.todaysPlayers.label')} columns={TODAYS_PLAYERS_COLUMNS} rowKey={(player) => player.memberId} narrowLayout="scroll"
          rows={shownBy(all, filter)} emptyText={t('console.todaysPlayers.noneOfStatus')}
          filter={{ label: t('console.todaysPlayers.filter'), text: (player) => player.fullName }} initialSort={{ key: 'status', direction: 'ascending' }}
          exportFilter={filter === 'all' ? '' : t('console.exportFilters.choice', { label: t('console.todaysPlayers.status'), value: label(filter) })} />
      </Stack>
    </Screen>
  );
}
