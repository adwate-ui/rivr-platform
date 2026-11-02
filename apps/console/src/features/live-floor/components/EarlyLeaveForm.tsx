import { useSeatActions, type SeatFailure } from '@rivr/db';
import { formatDuration, t } from '@rivr/i18n';
import { Button, Heading, Inline, Input, Stack, Text, StatusMessage } from '@rivr/ui';
import { useState } from 'react';

/** Who leaves early: a seated player, or one who has already left their seat (#79). */
export interface OwingMember {
  memberId: string;
  fullName: string;
  /** Whole seconds of call time still owed. */
  owed: number;
  /** A seated player's seat, freed once they are let go (decision 0299: one Leave); none for one who has left already. */
  sessionId?: string;
}

interface EarlyLeaveFormProps {
  venueId: string;
  member: OwingMember;
  onDone: (outcome: { ok: true } | { ok: false; error: SeatFailure }) => void;
  onCancel: () => void;
}

/**
 * An admin lets a member leave before their call time (#79; additions flow 13), with a reason kept on
 * their record with the admin's name: the cage can then cash them out. A seated player's seat is freed with it.
 */
export function EarlyLeaveForm({ venueId, member, onDone, onCancel }: EarlyLeaveFormProps) {
  const { letLeaveEarly, leave } = useSeatActions(venueId);
  const [reason, setReason] = useState('');
  const [isDone, setIsDone] = useState(false);
  // Freed owing, no waiver: the cage still holds their cash-out until an admin lets them go (#79).
  const leaveOwing = async () => {
    if (member.sessionId === undefined) return;
    const outcome = await leave.mutateAsync(member.sessionId);
    if (outcome.ok) onCancel();
    onDone(outcome);
  };
  const submit = async () => {
    const letGo = await letLeaveEarly.mutateAsync({ memberId: member.memberId, reason: reason.trim() });
    const outcome = letGo.ok && member.sessionId !== undefined ? await leave.mutateAsync(member.sessionId) : letGo;
    setIsDone(outcome.ok);
    onDone(outcome);
  };
  return (
    <Stack gap={3}>
      <Heading level={3} isFocusedOnMount>{t('console.liveFloor.leaveEarlyTitle', { name: member.fullName })}</Heading>
      <Text tone="muted">{t('console.liveFloor.leaveEarlyOwed', { time: formatDuration(member.owed) })}</Text>
      <StatusMessage>{isDone ? t('console.liveFloor.leftEarly') : null}</StatusMessage>
      {isDone ? null : (
        <Input label={t('console.liveFloor.leaveEarlyReason')} hint={t('console.liveFloor.leaveEarlyHint')} value={reason} maxLength={500}
          autoComplete="off" onChange={(event) => setReason(event.target.value)} />
      )}
      <Inline gap={3}>
        {isDone ? null : (
          <Button variant="secondary" isDisabled={reason.trim().length < 3} isLoading={letLeaveEarly.isPending || leave.isPending} onClick={() => void submit()}>
            {t('console.liveFloor.letLeaveEarly')}
          </Button>
        )}
        {isDone || member.sessionId === undefined ? null : (
          <Button variant="secondary" isLoading={leave.isPending} onClick={() => void leaveOwing()}>{t('console.liveFloor.leaveOwing')}</Button>
        )}
        <Button variant="text" onClick={onCancel}>{isDone ? t('common.close') : t('common.cancel')}</Button>
      </Inline>
    </Stack>
  );
}
