import { useLeftOwingCallTime, type LeftOwing, type SeatFailure } from '@rivr/db';
import { formatDuration, t } from '@rivr/i18n';
import { Button, ErrorMessage, Heading, Inline, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { EarlyLeaveForm } from './EarlyLeaveForm.tsx';
import { SEAT_FAILURE_COPY } from './seatCopy.ts';

/**
 * For admins on the Live floor (#79): members still in the room who left their seat before its call
 * time, so the cage refuses their cash-out until an admin lets them leave early. Nothing when there are none.
 */
export function LeftOwingCallTime({ venueId }: { venueId: string }) {
  const owing = useLeftOwingCallTime(venueId);
  const [chosen, setChosen] = useState<LeftOwing | null>(null);
  const [failure, setFailure] = useState<SeatFailure | null>(null);
  if (!owing.data?.length && chosen === null) return null;
  return (
    <Stack gap={3}>
      <Heading level={2}>{t('console.liveFloor.leftOwingTitle')}</Heading>
      <Stack gap={2} divided>
        {(owing.data ?? []).map((member) => (
          <Inline key={member.memberId} justify="between" align="center">
            <Inline gap={4}>
              <Text>{member.fullName}</Text>
              <Text tone="muted">{t('console.liveFloor.leftOwingLine', { table: member.tableName, time: formatDuration(member.owed) })}</Text>
            </Inline>
            <Button variant="text" aria-label={t('console.liveFloor.leaveEarlyName', { name: member.fullName })} onClick={() => setChosen(member)}>
              {t('console.liveFloor.leaveEarly')}
            </Button>
          </Inline>
        ))}
      </Stack>
      {failure === null ? null : <ErrorMessage>{t(SEAT_FAILURE_COPY[failure])}</ErrorMessage>}
      {chosen === null ? null : (
        <EarlyLeaveForm key={chosen.memberId} venueId={venueId} member={chosen} onCancel={() => setChosen(null)}
          onDone={(outcome) => setFailure(outcome.ok ? null : outcome.error)} />
      )}
    </Stack>
  );
}
