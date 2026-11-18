import { useCheckInActions, useCheckOutActions, useStaffVenue, type CheckInFailure, type CheckOutRefusal, type DoorPlayer } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, ErrorMessage, Screen, Stack } from '@rivr/ui';
import { useState, type ComponentType } from 'react';
import { CHECK_IN_FAILURE_COPY, checkOutRefusalText } from './checkInCopy.ts';
import { DoorField } from './DoorField.tsx';
import { DoorTable, type DoorChip } from './DoorTable.tsx';

/**
 * Check-in (#72), for the front desk (waitlist.manage), as the redesign's prototype has the Door: one field for a mobile
 * number, a member number or a name; then everyone at the door today as one table from the server (RD-30), by chip those in
 * the room, with Check out (#82), those expected (on a waitlist, not yet in), with Check in, and those who have left.
 */
export function CheckInScreen({ history }: { history?: ComponentType<{ venueId: string; memberId: string }> }) {
  const staff = useStaffVenue();
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  if (!staff.venue.permissions.includes('waitlist.manage')) {
    return <Screen title={t('console.checkIn.title')} status="error" errorText={t('console.checkIn.notAllowed')} />;
  }
  // Floor and up see members' numbers and History (#1073).
  return <CheckIn venueId={staff.venue.venueId} history={staff.venue.permissions.includes('members.phone') ? history : undefined} />;
}

/** The door's lists as chips: in the room first, as the prototype opens on it. */
const chips = (): readonly DoorChip[] => [
  { id: 'in_club', label: t('console.checkIn.inRoom'), list: 'in_club' },
  { id: 'expected', label: t('console.checkIn.expected'), list: 'expected' },
  { id: 'left', label: t('console.checkIn.left'), list: 'left' },
];

/** Checks a member in or out from their row, and why the last one did not go through. */
function useRowActions(venueId: string) {
  const { checkIn } = useCheckInActions(venueId);
  const { checkOut } = useCheckOutActions(venueId);
  const [failure, setFailure] = useState<{ in: CheckInFailure } | { out: CheckOutRefusal } | null>(null);
  return {
    failure: failure === null ? null : 'in' in failure ? t(CHECK_IN_FAILURE_COPY[failure.in]) : checkOutRefusalText(failure.out),
    isBusy: checkIn.isPending || checkOut.isPending,
    admit: async (memberId: string) => {
      const opened = await checkIn.mutateAsync(memberId);
      setFailure(opened.ok ? null : { in: opened.error });
    },
    release: async (memberId: string) => {
      const closed = await checkOut.mutateAsync(memberId);
      setFailure(closed.ok ? null : { out: closed.error });
    },
  };
}

function CheckIn({ venueId, history: History }: { venueId: string; history?: ComponentType<{ venueId: string; memberId: string }> | undefined }) {
  const actions = useRowActions(venueId);
  // A row's one button (redesign correction 3): Check out for a member in the room, Check in for one expected; none once they have left.
  const action = (player: DoorPlayer) => {
    if (player.list === 'in_club') {
      return <Button variant="subtle" size="small" isDisabled={actions.isBusy} aria-label={t('console.checkIn.checkOutMember', { name: player.fullName })}
        onClick={() => void actions.release(player.memberId)}>{t('console.checkIn.checkOut')}</Button>;
    }
    if (player.list !== 'expected') return null;
    return <Button variant="subtle" size="small" isDisabled={actions.isBusy} aria-label={t('console.checkIn.checkInMember', { name: player.fullName })}
      onClick={() => void actions.admit(player.memberId)}>{t('console.checkIn.checkIn')}</Button>;
  };
  return (
    <Screen title={t('console.checkIn.title')}>
      <Stack gap={6}>
        <DoorField venueId={venueId} />
        {actions.failure === null ? null : <ErrorMessage>{actions.failure}</ErrorMessage>}
        <DoorTable venueId={venueId} label={t('console.checkIn.doorLabel')} chipsLabel={t('console.checkIn.lists')} chips={chips()}
          emptyText={t('console.checkIn.noneOnList')} action={action}
          history={History === undefined ? undefined : (player) => <History venueId={venueId} memberId={player.memberId} />} />
      </Stack>
    </Screen>
  );
}
