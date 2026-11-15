import { useStaffVenue } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Screen } from '@rivr/ui';
import { DoorTable, type DoorChip } from './DoorTable.tsx';

/** The status chips (console v3), each with its count from the server: a player waiting counts whether in the room or expected at the door. */
const chips = (): readonly DoorChip[] => [
  { id: 'all', label: t('console.todaysPlayers.all') },
  { id: 'playing', label: t('console.todaysPlayers.statuses.playing'), statuses: ['playing'] },
  { id: 'waiting', label: t('console.todaysPlayers.statuses.waiting'), statuses: ['waiting', 'expected'] },
  { id: 'in_room', label: t('console.todaysPlayers.statuses.in_room'), statuses: ['in_room'] },
  { id: 'left', label: t('console.todaysPlayers.statuses.left'), statuses: ['left'] },
  { id: 'never_arrived', label: t('console.todaysPlayers.statuses.never_arrived'), statuses: ['never_arrived'] },
];

/**
 * Today's players (#641), for staff who read members: everyone at the club this club day, a page at a time from the server
 * (redesign RD-30), by status with a count on each (console v3), with their number, tier and ID check, when they checked
 * in and out, how long they waited, their tables and the time played.
 */
export function TodaysPlayersScreen() {
  const staff = useStaffVenue();
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  const title = t('console.todaysPlayers.title');
  if (!staff.venue.permissions.includes('members.read')) return <Screen title={title} status="error" errorText={t('console.todaysPlayers.notAllowed')} />;
  return (
    <Screen title={title}>
      <DoorTable venueId={staff.venue.venueId} label={t('console.todaysPlayers.label')} chipsLabel={t('console.todaysPlayers.status')} chips={chips()}
        emptyText={t('console.todaysPlayers.noneOfStatus')} />
    </Screen>
  );
}
