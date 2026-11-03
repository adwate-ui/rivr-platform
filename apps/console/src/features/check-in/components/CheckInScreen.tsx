import { useDoorBoard, useStaffVenue } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Grid, Screen, Stack, StaleNotice } from '@rivr/ui';
import { DoorField } from './DoorField.tsx';
import { DoorList } from './DoorList.tsx';

/**
 * Check-in (#72), for the front desk (waitlist.manage), as in the console v3 prototype: one field for a card the scanner
 * reads, a mobile number, a member number or a name; then the members expected (on a waitlist, not yet in the room) with
 * Check in, and who is in the room since when, with Check out (#82).
 */
export function CheckInScreen() {
  const staff = useStaffVenue();
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  if (!staff.venue.permissions.includes('waitlist.manage')) {
    return <Screen title={t('console.checkIn.title')} status="error" errorText={t('console.checkIn.notAllowed')} />;
  }
  return <CheckIn venueId={staff.venue.venueId} />;
}

function CheckIn({ venueId }: { venueId: string }) {
  const board = useDoorBoard(venueId);
  const title = t('console.checkIn.title');
  // A failed refresh keeps the lists and the scanner's field, with a notice, rather than swapping them for an error.
  if (board.data === undefined) {
    return board.isError
      ? <Screen title={title} status="error" onRetry={() => void board.refetch()} />
      : <Screen title={title} status="loading" loadingLook="rows" />;
  }
  return (
    <Screen title={title}>
      <Stack gap={6}>
        {board.isError ? <StaleNotice since={new Date(board.dataUpdatedAt)} onRetry={() => void board.refetch()} /> : null}
        <DoorField venueId={venueId} />
        {/* Each list in a Stack of its own, so a short list keeps its own height beside a long one. */}
        <Grid columns={2} gap={5} stackBelow="medium">
          <Stack>
            <DoorList venueId={venueId} title={t('console.checkIn.expected')} members={board.data.filter((member) => !member.isInRoom)}
              emptyText={t('console.checkIn.noneExpected')} />
          </Stack>
          <Stack>
            <DoorList venueId={venueId} title={t('console.checkIn.inRoom')} members={board.data.filter((member) => member.isInRoom)}
              emptyText={t('console.checkIn.noneInRoom')} />
          </Stack>
        </Grid>
      </Stack>
    </Screen>
  );
}
