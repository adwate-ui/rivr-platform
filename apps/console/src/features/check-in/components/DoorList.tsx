import { useCheckInActions, useCheckOutActions, type CheckInFailure, type CheckOutRefusal, type DoorMember } from '@rivr/db';
import { formatNumber, formatTime, t } from '@rivr/i18n';
import { Box, Button, ErrorMessage, Heading, Inline, Stack, Text } from '@rivr/ui';
import { useId, useState } from 'react';
import { CHECK_IN_FAILURE_COPY, checkOutRefusalText } from './checkInCopy.ts';

interface DoorListProps {
  venueId: string;
  title: string;
  members: readonly DoorMember[];
  emptyText: string;
}

interface RowProps {
  member: DoorMember;
  isBusy: boolean;
  onPress: () => void;
}

/** A member in the room: name, tier, when they checked in, and Check out (#82). */
function InRoomRow({ member, isBusy, onPress }: RowProps) {
  return (
    <Inline gap={3} justify="between">
      {/* The name gives way first, cut with an ellipsis, so the row stays one line on a phone. */}
      <Inline grow><Text truncate>{member.fullName}</Text></Inline>
      <Inline gap={4}>
        <Text variant="small" tone="muted">{member.tierName}</Text>
        <Text variant="small" tone="muted">{formatTime(new Date(member.since))}</Text>
        <Button variant="subtle" size="small" isDisabled={isBusy} aria-label={t('console.checkIn.checkOutMember', { name: member.fullName })}
          onClick={onPress}>{t('console.checkIn.checkOut')}</Button>
      </Inline>
    </Inline>
  );
}

/** A member expected at the door: name over tier, and Check in. */
function ExpectedRow({ member, isBusy, onPress }: RowProps) {
  return (
    <Inline gap={3} justify="between">
      <Stack gap={0}>
        <Text weight="medium">{member.fullName}</Text>
        <Text variant="caption" tone="muted">{member.tierName}</Text>
      </Stack>
      <Button variant="subtle" size="small" isDisabled={isBusy} aria-label={t('console.checkIn.checkInMember', { name: member.fullName })}
        onClick={onPress}>{t('console.checkIn.checkIn')}</Button>
    </Inline>
  );
}

/** Checks a member in or out from a list, and why the last one did not go through. */
function useListActions(venueId: string) {
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
 * One of the door's lists in its panel (console v3): its name and count, then a row per member. An expected member has
 * Check in; a member in the room the time they checked in and Check out. The panel is a region named by its heading.
 */
export function DoorList({ venueId, title, members, emptyText }: DoorListProps) {
  const actions = useListActions(venueId);
  const headingId = useId();
  return (
    <Box as="section" aria-labelledby={headingId} surface="raised" radius="md" paddingX={4} paddingY={3}>
      <Stack gap={0} divided>
        <Inline gap={3} justify="between">
          <Heading level={2} variant="subsection" id={headingId}>{title}</Heading>
          <Text variant="small" tone="muted">{formatNumber(members.length)}</Text>
        </Inline>
        {actions.failure === null ? null : <ErrorMessage>{actions.failure}</ErrorMessage>}
        {members.length === 0 ? <Text variant="small" tone="muted">{emptyText}</Text> : null}
        {members.map((member) => member.isInRoom
          ? <InRoomRow key={member.memberId} member={member} isBusy={actions.isBusy} onPress={() => void actions.release(member.memberId)} />
          : <ExpectedRow key={member.memberId} member={member} isBusy={actions.isBusy} onPress={() => void actions.admit(member.memberId)} />)}
      </Stack>
    </Box>
  );
}
