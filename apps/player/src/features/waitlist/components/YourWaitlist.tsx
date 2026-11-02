import { useWaitlistActions, type WaitlistFailure, type WaitlistPlace } from '@rivr/db';
import { formatStakes, formatTime, t } from '@rivr/i18n';
import { ConfirmButton, ErrorMessage, FloorRow, Heading, Inline, Stack } from '@rivr/ui';
import { useState } from 'react';
import { WAITLIST_FAILURE_COPY } from './waitlistCopy.ts';

const at = (iso: string) => formatTime(new Date(iso));

/** The line under a place: the seat call while it holds, away and kept until, a join waiting for the floor (#633), or the number on the list. */
function detailOf(place: WaitlistPlace): string {
  if (place.holdUntil !== null) {
    return t('player.tonight.seatReady', { table: place.callTableName ?? '', seat: place.callSeat ?? 0, time: at(place.holdUntil) });
  }
  if (place.awayUntil !== null) return t('player.tonight.away', { time: at(place.awayUntil) });
  if (place.place === null) return t('player.tonight.request', { time: at(place.joinedAt) });
  return t('player.tonight.place', { place: place.place, time: at(place.joinedAt) });
}

/**
 * The member's waitlist places: the game, their number on its list and when they joined, or the seat
 * call while it holds (#63); Step away and I'm back, and Leave. Nothing when there are none.
 */
export function YourWaitlist({ places }: { places: readonly WaitlistPlace[] }) {
  const { leave } = useWaitlistActions();
  const [failure, setFailure] = useState<WaitlistFailure | null>(null);
  // The place whose Step away or Leave is pending, so only its buttons say so (F3-17).
  const [busyAt, setBusyAt] = useState<string | null>(null);
  if (places.length === 0) return null;
  const act = async (entryId: string, done: Promise<{ ok: true } | { ok: false; error: WaitlistFailure }>) => {
    setBusyAt(entryId);
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
          // A game's name often carries its stakes ("NLH 100/200"): then they show once (P-05); a name without them keeps them.
          {...(place.tableTypeName.includes(formatStakes(place.smallBlind, place.bigBlind)) ? {} : { smallBlind: place.smallBlind, bigBlind: place.bigBlind })}
          detail={detailOf(place)}
          action={
            <Inline gap={2}>
              <ConfirmButton variant="secondary" label={t('player.tonight.leave')} name={t('player.tonight.leaveName', { game: place.tableTypeName })}
                confirm={t('player.tonight.confirmLeave')} isBusy={leave.isPending && busyAt === place.entryId}
                onConfirm={() => void act(place.entryId, leave.mutateAsync(place.entryId))} />
            </Inline>
          }
        />
      ))}
      {failure === null ? null : <ErrorMessage>{t(WAITLIST_FAILURE_COPY[failure])}</ErrorMessage>}
    </Stack>
  );
}
