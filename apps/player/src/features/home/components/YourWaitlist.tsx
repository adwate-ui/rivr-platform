import { useWaitlistActions, type WaitlistFailure, type WaitlistPlace } from '@rivr/db';
import { formatTime, t } from '@rivr/i18n';
import { Button, ErrorMessage, FloorRow, Heading, Stack } from '@rivr/ui';
import { useState } from 'react';
import { WAITLIST_FAILURE_COPY } from './waitlistCopy.ts';

/** The member's waitlist places: the game, their number on its list and when they joined, and Leave. Nothing when none. */
export function YourWaitlist({ places }: { places: readonly WaitlistPlace[] }) {
  const { leave } = useWaitlistActions();
  const [failure, setFailure] = useState<WaitlistFailure | null>(null);
  if (places.length === 0) return null;
  const leaveList = async (entryId: string) => {
    const left = await leave.mutateAsync(entryId);
    setFailure(left.ok ? null : left.error);
  };
  return (
    <Stack gap={4}>
      <Heading level={2}>{t('player.tonight.yourWaitlist')}</Heading>
      {places.map((place) => (
        <FloorRow
          key={place.entryId}
          name={place.tableTypeName}
          smallBlind={place.smallBlind}
          bigBlind={place.bigBlind}
          detail={t('player.tonight.place', { place: place.place, time: formatTime(new Date(place.joinedAt)) })}
          action={
            <Button variant="secondary" isLoading={leave.isPending} onClick={() => void leaveList(place.entryId)}>
              {t('player.tonight.leave')}
            </Button>
          }
        />
      ))}
      {failure === null ? null : <ErrorMessage>{t(WAITLIST_FAILURE_COPY[failure])}</ErrorMessage>}
    </Stack>
  );
}
