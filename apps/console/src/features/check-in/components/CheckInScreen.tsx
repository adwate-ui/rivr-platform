import { useDoorBoard, useStaffVenue, type DoorMember } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Grid, Screen } from '@rivr/ui';
import { CardCheckIn } from './CardCheckIn.tsx';
import { DoorList } from './DoorList.tsx';
import { PhoneCheckIn } from './PhoneCheckIn.tsx';

/**
 * Check-in (#72), for the front desk (waitlist.manage), as in the prototype: the members expected
 * (on a waitlist, not yet in the room) with Check in, and who is in the room since when. A member is
 * also checked in by their membership card, which the door's scanner reads (#71), or by mobile number.
 */
export function CheckInScreen() {
  const staff = useStaffVenue();
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  if (!staff.venue.permissions.includes('waitlist.manage')) {
    return <Screen title={t('console.checkIn.title')} status="error" errorText={t('console.checkIn.notAllowed')} />;
  }
  return <Door venueId={staff.venue.venueId} />;
}

function Door({ venueId }: { venueId: string }) {
  const board = useDoorBoard(venueId);
  const title = t('console.checkIn.title');
  if (board.isPending) return <Screen title={title} status="loading" />;
  if (board.isError) return <Screen title={title} status="error" onRetry={() => void board.refetch()} />;
  const expected: DoorMember[] = board.data.filter((member) => !member.isInRoom);
  const inRoom: DoorMember[] = board.data.filter((member) => member.isInRoom);
  return (
    <Screen title={title}>
      <Grid columns={2} gap={8} stackBelow="medium">
        <CardCheckIn venueId={venueId} />
        <PhoneCheckIn venueId={venueId} />
      </Grid>
      <Grid columns={2} gap={8} stackBelow="medium">
        <DoorList venueId={venueId} title={t('console.checkIn.expected')} members={expected} emptyText={t('console.checkIn.noneExpected')} />
        <DoorList venueId={venueId} title={t('console.checkIn.inRoom')} members={inRoom} emptyText={t('console.checkIn.noneInRoom')} />
      </Grid>
    </Screen>
  );
}
