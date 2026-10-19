import { useCheckInActions, type CheckInFailure, type DoorMember } from '@rivr/db';
import { formatTime, t } from '@rivr/i18n';
import { Button, ErrorMessage, Heading, Inline, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { CHECK_IN_FAILURE_COPY } from './checkInCopy.ts';

interface DoorListProps {
  venueId: string;
  title: string;
  members: readonly DoorMember[];
  emptyText: string;
}

/**
 * One of the door's lists, as in the prototype: each member's name and tier; an expected member has
 * Check in, a member in the room the time they checked in.
 */
export function DoorList({ venueId, title, members, emptyText }: DoorListProps) {
  const { checkIn } = useCheckInActions(venueId);
  const [failure, setFailure] = useState<CheckInFailure | null>(null);
  const checkInLabel = t('console.checkIn.checkIn');
  const admit = async (memberId: string) => {
    const opened = await checkIn.mutateAsync(memberId);
    setFailure(opened.ok ? null : opened.error);
  };
  // A line under the heading and between rows, as in the prototype.
  return (
    <Stack gap={3} divided>
      <Heading level={2}>{title}</Heading>
      {failure === null ? null : <ErrorMessage>{t(CHECK_IN_FAILURE_COPY[failure])}</ErrorMessage>}
      {members.length === 0 ? <Text tone="muted">{emptyText}</Text> : null}
      {members.map((member) => member.isInRoom ? (
        <Inline key={member.memberId} justify="between" align="center">
          <Text>{member.fullName}</Text>
          <Inline gap={8} align="center">
            <Text tone="muted">{member.tierName}</Text>
            <Text tone="muted">{formatTime(new Date(member.since))}</Text>
          </Inline>
        </Inline>
      ) : (
        <Inline key={member.memberId} justify="between" align="center">
          <Inline gap={2} align="center">
            <Text>{member.fullName}</Text>
            <Text tone="muted">{member.tierName}</Text>
          </Inline>
          <Button variant="text" isDisabled={checkIn.isPending} aria-label={t('console.checkIn.checkInMember', { name: member.fullName })}
            onClick={() => void admit(member.memberId)}>{checkInLabel}</Button>
        </Inline>
      ))}
    </Stack>
  );
}
