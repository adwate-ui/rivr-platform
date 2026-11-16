import { formatDuration, t, type MessageKey } from '@rivr/i18n';
import { Button, ChoiceChips, ErrorMessage, Sheet, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import type { SeatChanges } from './useSeatChanges.ts';

/** Who leaves: a seated player (their seat freed), or a member who already left their seat owing call time. */
export interface Leaver {
  readonly memberId: string;
  readonly fullName: string;
  readonly tableName: string;
  /** The seat they sit in; none for one who already left it. */
  readonly seat: { readonly sessionId: string; readonly number: number } | null;
  /** Whole seconds of call time still owed; 0 when met or none given. */
  readonly owedSeconds: number;
}

/** The reasons to let a player go before their call time (console v3), in the words kept on their member record. */
const REASONS: readonly MessageKey[] = [
  'console.floor.leave.emergency', 'console.floor.leave.unwell', 'console.floor.leave.tableBroke', 'console.floor.leave.floorDecision',
  'console.floor.leave.busted',
];

export interface LeaveSheetProps {
  leaver: Leaver;
  /** Staff with the override (call_time.override) let a player go early, with a reason (decision 0306). */
  canLetGo: boolean;
  /** Staff who check players in and out at the door (waitlist.manage) may also check the player out of the club (owner, 16 Nov). */
  canCheckOut: boolean;
  changes: SeatChanges;
  onClose: () => void;
}

/** What the sheet's main action says, and how it looks: red to let go early, gold otherwise. */
function confirmOf(owes: boolean, canLetGo: boolean): { label: MessageKey; variant: 'danger' | 'primary' } {
  if (owes && canLetGo) return { label: 'console.floor.leave.confirmOwes', variant: 'danger' };
  return { label: owes ? 'console.floor.leave.leaveOwing' : 'console.floor.leave.confirm', variant: 'primary' };
}

/**
 * The same action that also checks the player out, where the check-out would go through: let go early with the override,
 * or leave owing nothing from a seat. Freeing a seat owing call time keeps the member in the club, so it has none.
 */
function checkOutOf(owes: boolean, { leaver, canLetGo, canCheckOut }: LeaveSheetProps): MessageKey | null {
  if (!canCheckOut) return null;
  if (owes) return canLetGo ? 'console.floor.leave.confirmOwesOut' : null;
  return leaver.seat === null ? null : 'console.floor.leave.confirmOut';
}

/** Lets the player go early with the reason, or leave from their seat; and checks them out of the club with it if asked. */
async function leaveAs(props: LeaveSheetProps, reason: MessageKey | null, isCheckingOut: boolean): Promise<void> {
  const { leaver, canLetGo, changes } = props;
  if (leaver.owedSeconds > 0 && canLetGo && reason !== null) {
    return changes.letGo({ memberId: leaver.memberId, fullName: leaver.fullName, sessionId: leaver.seat?.sessionId }, t(reason), isCheckingOut);
  }
  if (leaver.seat === null) return undefined;
  const player = { sessionId: leaver.seat.sessionId, memberId: leaver.memberId, fullName: leaver.fullName };
  return isCheckingOut ? changes.leaveAndCheckOut(player, leaver.tableName) : changes.leave(player, leaver.tableName);
}

/**
 * Leave (console v3). With the call time met, or none: Yes, they leave, with Undo. Owing, staff with the override pick
 * one of Emergency, Unwell, Table broke, Floor decision or Busted, which is written to the member's record with their name,
 * and let the player go early (not undone, decision 0481); other floor staff free the seat owing, with Undo (decision 0306).
 * Beside Let go early and Yes, they leave, staff with the door's permission choose the same and check out of the club too
 * (owner, 16 Nov).
 */
export function LeaveSheet(props: LeaveSheetProps) {
  const { leaver, canLetGo, onClose } = props;
  const [reason, setReason] = useState<MessageKey | null>(null);
  const [isMissing, setMissing] = useState(false);
  // A press under way: a second would end the seat again, or check out twice.
  const [isBusy, setBusy] = useState(false);
  const owes = leaver.owedSeconds > 0;
  const confirm = confirmOf(owes, canLetGo);
  const checkOut = checkOutOf(owes, props);
  const go = async (isCheckingOut: boolean) => {
    if (isBusy) return;
    if (owes && canLetGo && reason === null) return setMissing(true);
    setBusy(true);
    await leaveAs(props, reason, isCheckingOut);
    onClose();
  };
  const where = leaver.seat === null ? leaver.tableName : t('console.floor.requests.seatDetail', { table: leaver.tableName, seat: leaver.seat.number });
  return (
    <Sheet place="console" isOpen onClose={onClose} title={owes ? t('console.floor.leave.titleOwes') : t('console.floor.leave.title', { name: leaver.fullName })}
      subtitle={t('console.floor.leave.subtitle', { name: leaver.fullName, where })}
      footer={<>
        <Button variant="text" onClick={onClose}>{t('console.floor.leave.cancel')}</Button>
        {checkOut === null ? null : <Button variant="outline" isDisabled={isBusy} onClick={() => void go(true)}>{t(checkOut)}</Button>}
        <Button variant={confirm.variant} isLoading={isBusy} onClick={() => void go(false)}>{t(confirm.label)}</Button>
      </>}>
      <Text>{owes ? t('console.floor.leave.owes', { name: leaver.fullName, time: formatDuration(leaver.owedSeconds) }) : t('console.floor.leave.free')}</Text>
      {owes && canLetGo ? (
        <Stack gap={3}>
          <Text variant="caption" tone="muted">{t('console.floor.leave.reason')}</Text>
          <ChoiceChips look="subtle" mode="one" label={t('console.floor.leave.reason')} isLabelVisuallyHidden selected={reason === null ? [] : [reason]}
            options={REASONS.map((key) => ({ value: key, label: t(key) }))}
            onChange={([value]) => { setReason(REASONS.find((key) => key === value) ?? null); setMissing(false); }} />
        </Stack>
      ) : null}
      {isMissing ? <ErrorMessage>{t('console.floor.leave.pickReason')}</ErrorMessage> : null}
    </Sheet>
  );
}
