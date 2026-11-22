import { useCheckInActions, useCheckOutActions, useStaffVenue, type CheckInFailure, type CheckOutRefusal, type DoorPlayer } from '@rivr/db';
import { useMemberBonus } from '@rivr/db/bonus';
import { isPositive } from '@rivr/domain/money';
import { formatChips, t } from '@rivr/i18n';
import { Button, ErrorMessage, Inline, Screen, Sheet, Stack } from '@rivr/ui';
import { useState, type ComponentType } from 'react';
import { CHECK_IN_FAILURE_COPY, checkOutRefusalText } from './checkInCopy.ts';
import { DoorField } from './DoorField.tsx';
import { DoorTable, type DoorChip } from './DoorTable.tsx';

/** The form that uses a member's Bonus without a seat (the owner, 20 Nov), as the route hands it in from the record. */
type BonusForm = ComponentType<{ venueId: string; memberId: string }>;

/**
 * Check-in (#72), for the front desk (waitlist.manage), as the redesign's prototype has the Door: one field for a mobile
 * number, a member number or a name; then everyone at the door today as one table from the server (RD-30), by chip those in
 * the room, with Check out (#82), those expected (on a waitlist, not yet in), with Check in, and those who have left.
 */
export function CheckInScreen({ history, bonusForm }: { history?: ComponentType<{ venueId: string; memberId: string }>; bonusForm?: BonusForm }) {
  const staff = useStaffVenue();
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  if (!staff.venue.permissions.includes('waitlist.manage')) {
    return <Screen title={t('console.checkIn.title')} status="error" errorText={t('console.checkIn.notAllowed')} />;
  }
  // Floor and up see members' numbers and History (#1073); those who give Bonus by hand use it from the row.
  return <CheckIn venueId={staff.venue.venueId} history={staff.venue.permissions.includes('members.phone') ? history : undefined}
    bonusForm={staff.venue.permissions.includes('bonus.give') ? bonusForm : undefined} />;
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

/**
 * A member's first row, whatever their list, when their wallet holds Bonus and they are not erased: it alone carries their
 * day's Bonus given (`bonus`) and their wallet, and offers the Bonus they use without a seat, which an empty wallet or an
 * erased record would only refuse.
 */
const offersBonus = (player: DoorPlayer) =>
  player.linkedMemberId !== null && player.bonus !== null && player.wallet !== null && isPositive(player.wallet);

/** A row's one button (redesign correction 3): Check out for a member in the room, Check in for one expected; none once they have left. */
function rowButton(player: DoorPlayer, actions: ReturnType<typeof useRowActions>) {
  if (player.list === 'in_club') {
    return <Button variant="subtle" size="small" isDisabled={actions.isBusy} aria-label={t('console.checkIn.checkOutMember', { name: player.fullName })}
      onClick={() => void actions.release(player.memberId)}>{t('console.checkIn.checkOut')}</Button>;
  }
  if (player.list !== 'expected') return null;
  return <Button variant="subtle" size="small" isDisabled={actions.isBusy} aria-label={t('console.checkIn.checkInMember', { name: player.fullName })}
    onClick={() => void actions.admit(player.memberId)}>{t('console.checkIn.checkIn')}</Button>;
}

/** Use Bonus's form in the panel at the side, for the member whose row opened it (the owner, 20 Nov). */
function BonusSheet({ venueId, using, form, onClose }: { venueId: string; using: DoorPlayer | null; form: BonusForm | undefined; onClose: () => void }) {
  if (using === null || form === undefined) return null;
  return <OpenBonusSheet venueId={venueId} using={using} form={form} onClose={onClose} />;
}

/** The sheet, with the member's Bonus now under their name, as their record has it; a use reads it again (the UI review, 20 Nov). */
function OpenBonusSheet({ venueId, using, form: Form, onClose }: { venueId: string; using: DoorPlayer; form: BonusForm; onClose: () => void }) {
  const balance = useMemberBonus(venueId, using.memberId);
  const subtitle = balance.data === undefined || balance.data === null ? undefined : t('console.checkIn.bonusNow', { chips: formatChips(balance.data) });
  return <Sheet place="console" isOpen onClose={onClose} title={using.fullName} subtitle={subtitle}><Form venueId={venueId} memberId={using.memberId} /></Sheet>;
}

function CheckIn({ venueId, history: History, bonusForm }: { venueId: string; history?: ComponentType<{ venueId: string; memberId: string }> | undefined; bonusForm?: BonusForm | undefined }) {
  const actions = useRowActions(venueId);
  const [using, setUsing] = useState<DoorPlayer | null>(null);
  // A member's first row, whatever their list, has Use Bonus too while their wallet holds some, for those who give Bonus by
  // hand, checked in or not (the owner, 22 Nov): a text button, as History is, so the two share a line in the row's cell (doorColumns) and the row's
  // button goes beneath them (the UI review, 20 Nov).
  const action = (player: DoorPlayer) => {
    const button = rowButton(player, actions);
    if (bonusForm === undefined || !offersBonus(player)) return button;
    const useBonus = <Button variant="text" size="small" aria-label={t('console.checkIn.useBonusMember', { name: player.fullName })}
      onClick={() => setUsing(player)}>{t('console.checkIn.useBonus')}</Button>;
    if (button === null) return useBonus;
    return History === undefined ? <Inline gap={2} justify="end" wrap>{useBonus}{button}</Inline> : <>{useBonus}{button}</>;
  };
  return (
    <Screen title={t('console.checkIn.title')}>
      <Stack gap={6}>
        <DoorField venueId={venueId} />
        {actions.failure === null ? null : <ErrorMessage>{actions.failure}</ErrorMessage>}
        <DoorTable venueId={venueId} label={t('console.checkIn.doorLabel')} chipsLabel={t('console.checkIn.lists')} chips={chips()}
          emptyText={t('console.checkIn.noneOnList')} action={action}
          history={History === undefined ? undefined : (player) => <History venueId={venueId} memberId={player.memberId} />} />
        <BonusSheet venueId={venueId} using={using} form={bonusForm} onClose={() => setUsing(null)} />
      </Stack>
    </Screen>
  );
}
