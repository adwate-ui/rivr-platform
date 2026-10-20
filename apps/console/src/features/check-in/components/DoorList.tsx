import { useCheckInActions, useCheckOutActions, type CheckInFailure, type CheckOutRefusal, type DoorMember } from '@rivr/db';
import { formatTime, t } from '@rivr/i18n';
import { Button, ErrorMessage, Heading, Inline, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { CHECK_IN_FAILURE_COPY, checkOutRefusalText } from './checkInCopy.ts';

interface DoorListProps {
  venueId: string;
  title: string;
  members: readonly DoorMember[];
  emptyText: string;
}

/** A member in the room: name, tier, when they checked in, and Check out (#82). */
function InRoomRow({ member, isBusy, onCheckOut }: { member: DoorMember; isBusy: boolean; onCheckOut: () => void }) {
  return (
    <Inline justify="between" align="center">
      <Text>{member.fullName}</Text>
      <Inline gap={8} align="center">
        <Text tone="muted">{member.tierName}</Text>
        <Text tone="muted">{formatTime(new Date(member.since))}</Text>
        <Button variant="text" isDisabled={isBusy} aria-label={t('console.checkIn.checkOutMember', { name: member.fullName })}
          onClick={onCheckOut}>{t('console.checkIn.checkOut')}</Button>
      </Inline>
    </Inline>
  );
}

/** A member expected at the door: name, tier, and Check in. */
function ExpectedRow({ member, isBusy, onCheckIn }: { member: DoorMember; isBusy: boolean; onCheckIn: () => void }) {
  return (
    <Inline justify="between" align="center">
      <Inline gap={2} align="center">
        <Text>{member.fullName}</Text>
        <Text tone="muted">{member.tierName}</Text>
      </Inline>
      <Button variant="text" isDisabled={isBusy} aria-label={t('console.checkIn.checkInMember', { name: member.fullName })}
        onClick={onCheckIn}>{t('console.checkIn.checkIn')}</Button>
    </Inline>
  );
}

/**
 * One of the door's lists, as in the prototype: each member's name and tier; an expected member has
 * Check in, a member in the room the time they checked in and Check out.
 */
export function DoorList({ venueId, title, members, emptyText }: DoorListProps) {
  const { checkIn } = useCheckInActions(venueId);
  const { checkOut } = useCheckOutActions(venueId);
  const [failure, setFailure] = useState<{ in: CheckInFailure } | { out: CheckOutRefusal } | null>(null);
  const admit = async (memberId: string) => {
    const opened = await checkIn.mutateAsync(memberId);
    setFailure(opened.ok ? null : { in: opened.error });
  };
  const release = async (memberId: string) => {
    const closed = await checkOut.mutateAsync(memberId);
    setFailure(closed.ok ? null : { out: closed.error });
  };
  // A line under the heading and between rows, as in the prototype.
  return (
    <Stack gap={3} divided>
      <Heading level={2}>{title}</Heading>
      {failure === null ? null : <ErrorMessage>{'in' in failure ? t(CHECK_IN_FAILURE_COPY[failure.in]) : checkOutRefusalText(failure.out)}</ErrorMessage>}
      {members.length === 0 ? <Text tone="muted">{emptyText}</Text> : null}
      {members.map((member) => member.isInRoom
        ? <InRoomRow key={member.memberId} member={member} isBusy={checkOut.isPending} onCheckOut={() => void release(member.memberId)} />
        : <ExpectedRow key={member.memberId} member={member} isBusy={checkIn.isPending} onCheckIn={() => void admit(member.memberId)} />)}
    </Stack>
  );
}
