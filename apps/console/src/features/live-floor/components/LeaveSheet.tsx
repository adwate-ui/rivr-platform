import { LEAVE_REASONS, type LeaveReason } from '@rivr/contracts';
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
  /** Whether call time is owed (#1076): one is, until a call time is set and has run out. */
  readonly owes: boolean;
  /** Whole seconds of call time left; 0 when met, none given, or a call time never set. */
  readonly owedSeconds: number;
}

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

/** What is owed, in words: the time left, that no call time was set (#1076), or nothing. */
function owedWords(leaver: Leaver): string {
  if (!leaver.owes) return t('console.floor.leave.free');
  return leaver.owedSeconds > 0
    ? t('console.floor.leave.owes', { name: leaver.fullName, time: formatDuration(leaver.owedSeconds) })
    : t('console.floor.leave.notSet', { name: leaver.fullName });
}

/** Lets the player go early with the reason, or leave from their seat with it; and checks them out of the club with it if asked. */
async function leaveAs(props: LeaveSheetProps, reason: LeaveReason, isCheckingOut: boolean): Promise<void> {
  const { leaver, canLetGo, changes } = props;
  if (leaver.owes && canLetGo) {
    return changes.letGo({ memberId: leaver.memberId, fullName: leaver.fullName, sessionId: leaver.seat?.sessionId }, reason, isCheckingOut);
  }
  if (leaver.seat === null) return undefined;
  const player = { sessionId: leaver.seat.sessionId, memberId: leaver.memberId, fullName: leaver.fullName };
  return isCheckingOut ? changes.leaveAndCheckOut(player, leaver.tableName, reason) : changes.leave(player, leaver.tableName, reason);
}

/**
 * Leave (console v3). Every leave says why (#1060, the owner, 17 Nov): Call time met, picked already when no call time is
 * owed, Busted, Emergency, Unwell, Table broke or Floor decision, kept on the seat and shown on the member's record. With
 * nothing owed: Yes, they leave, with Undo. Owing, staff with the override let the player go early, the reason written to
 * the member's record with their name (not undone, decision 0481); other floor staff free the seat owing, with Undo
 * (decision 0306). Beside Let go early and Yes, they leave, staff with the door's permission choose the same and check out
 * of the club too (owner, 16 Nov).
 */
export function LeaveSheet(props: LeaveSheetProps) {
  const { leaver, canLetGo, onClose } = props;
  // Call time met is picked until staff pick another, while nothing is owed; owing, none is.
  const [picked, setPicked] = useState<LeaveReason | null>(null);
  const reason = picked ?? (leaver.owes ? null : 'call_time_met');
  const [isMissing, setMissing] = useState(false);
  // A press under way: a second would end the seat again, or check out twice.
  const [isBusy, setBusy] = useState(false);
  const owes = leaver.owes;
  const confirm = confirmOf(owes, canLetGo);
  const checkOut = checkOutOf(owes, props);
  const go = async (isCheckingOut: boolean) => {
    if (isBusy) return;
    if (reason === null) return setMissing(true);
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
      <Text>{owedWords(leaver)}</Text>
      <Stack gap={3}>
        <Text variant="caption" tone="muted">{t('console.floor.leave.reason')}</Text>
        <ChoiceChips look="subtle" mode="one" label={t('console.floor.leave.reason')} isLabelVisuallyHidden selected={reason === null ? [] : [reason]}
          options={LEAVE_REASONS.map((code) => ({ value: code, label: t(`common.leaveReasons.${code}`) }))}
          onChange={([value]) => { setPicked(LEAVE_REASONS.find((code) => code === value) ?? null); setMissing(false); }} />
      </Stack>
      {isMissing ? <ErrorMessage>{t('console.floor.leave.pickReason')}</ErrorMessage> : null}
    </Sheet>
  );
}
