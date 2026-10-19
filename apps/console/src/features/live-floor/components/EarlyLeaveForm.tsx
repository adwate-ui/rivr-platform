import { useSeatActions, type SeatFailure } from '@rivr/db';
import { formatDuration, t } from '@rivr/i18n';
import { Button, Heading, Inline, Input, Stack, Text } from '@rivr/ui';
import { useState } from 'react';

/** Who leaves early: a seated player, or one who has already left their seat (#79). */
export interface OwingMember {
  memberId: string;
  fullName: string;
  /** Whole seconds of call time still owed. */
  owed: number;
}

interface EarlyLeaveFormProps {
  venueId: string;
  member: OwingMember;
  onDone: (outcome: { ok: true } | { ok: false; error: SeatFailure }) => void;
  onCancel: () => void;
}

/**
 * An admin lets a member leave before their call time (#79; additions flow 13), with a reason kept on
 * their record with the admin's name: the cage can then cash them out.
 */
export function EarlyLeaveForm({ venueId, member, onDone, onCancel }: EarlyLeaveFormProps) {
  const { letLeaveEarly } = useSeatActions(venueId);
  const [reason, setReason] = useState('');
  const [isDone, setIsDone] = useState(false);
  const submit = async () => {
    const outcome = await letLeaveEarly.mutateAsync({ memberId: member.memberId, reason: reason.trim() });
    setIsDone(outcome.ok);
    onDone(outcome);
  };
  return (
    <Stack gap={3}>
      <Heading level={3}>{t('console.liveFloor.leaveEarlyTitle', { name: member.fullName })}</Heading>
      <Text tone="muted">{t('console.liveFloor.leaveEarlyOwed', { time: formatDuration(member.owed) })}</Text>
      {isDone ? <Text>{t('console.liveFloor.leftEarly')}</Text> : (
        <Input label={t('console.liveFloor.leaveEarlyReason')} hint={t('console.liveFloor.leaveEarlyHint')} value={reason} maxLength={500}
          autoComplete="off" onChange={(event) => setReason(event.target.value)} />
      )}
      <Inline gap={3}>
        {isDone ? null : (
          <Button variant="secondary" isDisabled={reason.trim().length < 3} isLoading={letLeaveEarly.isPending} onClick={() => void submit()}>
            {t('console.liveFloor.letLeaveEarly')}
          </Button>
        )}
        <Button variant="text" onClick={onCancel}>{isDone ? t('common.close') : t('common.cancel')}</Button>
      </Inline>
    </Stack>
  );
}
