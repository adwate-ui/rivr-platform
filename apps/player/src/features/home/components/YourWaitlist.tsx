import { useWaitlistActions, type WaitlistFailure, type WaitlistPlace } from '@rivr/db';
import { formatTime, t } from '@rivr/i18n';
import { Button, ErrorMessage, FloorRow, Heading, Inline, Stack } from '@rivr/ui';
import { useState } from 'react';
import { WAITLIST_FAILURE_COPY } from './waitlistCopy.ts';

const at = (iso: string) => formatTime(new Date(iso));

/** The line under a place: the seat call while it holds, away and kept until, or the number on the list. */
function detailOf(place: WaitlistPlace): string {
  if (place.holdUntil !== null) {
    return t('player.tonight.seatReady', { table: place.callTableName ?? '', seat: place.callSeat ?? 0, time: at(place.holdUntil) });
  }
  if (place.awayUntil !== null) return t('player.tonight.away', { time: at(place.awayUntil) });
  return t('player.tonight.place', { place: place.place, time: at(place.joinedAt) });
}

/**
 * The member's waitlist places: the game, their number on its list and when they joined, or the seat
 * call while it holds (#63); Step away and I'm back, and Leave. Nothing when there are none.
 */
export function YourWaitlist({ places }: { places: readonly WaitlistPlace[] }) {
  const { leave, stepAway } = useWaitlistActions();
  const [failure, setFailure] = useState<WaitlistFailure | null>(null);
  if (places.length === 0) return null;
  const act = async (done: Promise<{ ok: true } | { ok: false; error: WaitlistFailure }>) => {
    const outcome = await done;
    setFailure(outcome.ok ? null : outcome.error);
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
          detail={detailOf(place)}
          action={
            <Inline gap={2}>
              {place.holdUntil !== null ? null : (
                <Button variant="text" isLoading={stepAway.isPending}
                  onClick={() => void act(stepAway.mutateAsync({ entryId: place.entryId, isAway: place.awayUntil === null }))}>
                  {place.awayUntil === null ? t('player.tonight.stepAway') : t('player.tonight.back')}
                </Button>
              )}
              <Button variant="secondary" isLoading={leave.isPending} onClick={() => void act(leave.mutateAsync(place.entryId))}>
                {t('player.tonight.leave')}
              </Button>
            </Inline>
          }
        />
      ))}
      {failure === null ? null : <ErrorMessage>{t(WAITLIST_FAILURE_COPY[failure])}</ErrorMessage>}
    </Stack>
  );
}
