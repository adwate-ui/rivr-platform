import { useFloorWaitlistActions, useWaitlistCallActions, type FloorTable, type WaitlistBoardEntry, type WaitlistFailure } from '@rivr/db';
import { formatTime, t } from '@rivr/i18n';
import { Button, ErrorMessage, Inline, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { CallForm } from './CallForm.tsx';
import { FAILURE_COPY } from './failureCopy.ts';

const at = (iso: string) => formatTime(new Date(iso));

/** One place: number, name and when they joined, and why it is ahead of join time when it is. */
function entryLine(entry: WaitlistBoardEntry): string {
  const line = { place: entry.place, name: entry.fullName, time: at(entry.joinedAt) };
  return entry.priorityReason === null ? t('console.waitlist.entry', line) : t('console.waitlist.entryWithReason', { ...line, reason: entry.priorityReason });
}

/** Where the place stands: called to a seat and held until, away and kept until, or nothing more. */
function standing(entry: WaitlistBoardEntry): string | null {
  if (entry.holdUntil !== null) {
    return t('console.waitlist.called', { table: entry.callTableName ?? '', seat: entry.callSeat ?? 0, time: at(entry.holdUntil) });
  }
  return entry.awayUntil === null ? null : t('console.waitlist.away', { time: at(entry.awayUntil) });
}

/** One place on a list with the floor's actions: Call, then Seat; Skip and Back; Remove. */
export function EntryRow({ venueId, entry, tables }: { venueId: string; entry: WaitlistBoardEntry; tables: readonly FloorTable[] }) {
  const { remove } = useFloorWaitlistActions(venueId);
  const { seat, away } = useWaitlistCallActions();
  const [isCalling, setIsCalling] = useState(false);
  const [failure, setFailure] = useState<WaitlistFailure | null>(null);
  const act = async (done: Promise<{ ok: true } | { ok: false; error: WaitlistFailure }>) => {
    const outcome = await done;
    setFailure(outcome.ok ? null : outcome.error);
  };
  const state = standing(entry);
  const name = entry.fullName;
  return (
    <Stack gap={3}>
      <Inline gap={4} align="center" justify="between" wrap>
        <Stack gap={1}>
          <Text>{entryLine(entry)}</Text>
          {state === null ? null : <Text variant="small">{state}</Text>}
          {entry.addedByFloor ? <Text variant="small" tone="muted">{t('console.waitlist.addedByFloor')}</Text> : null}
        </Stack>
        <Inline gap={2} wrap>
          {entry.holdUntil !== null ? (
            <Button variant="secondary" isLoading={seat.isPending} onClick={() => void act(seat.mutateAsync(entry.entryId))}>{t('console.waitlist.seat', { name })}</Button>
          ) : entry.awayUntil !== null ? (
            <Button variant="secondary" onClick={() => void act(away.mutateAsync({ entryId: entry.entryId, isAway: false }))}>{t('console.waitlist.back', { name })}</Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setIsCalling(true)}>{t('console.waitlist.call', { name })}</Button>
              <Button variant="text" onClick={() => void act(away.mutateAsync({ entryId: entry.entryId, isAway: true }))}>{t('console.waitlist.skip', { name })}</Button>
            </>
          )}
          <Button variant="text" isLoading={remove.isPending} onClick={() => void act(remove.mutateAsync(entry.entryId))}>{t('console.waitlist.remove', { name })}</Button>
        </Inline>
      </Inline>
      {isCalling ? <CallForm entryId={entry.entryId} name={name} tables={tables} onDone={() => setIsCalling(false)} /> : null}
      {failure === null ? null : <ErrorMessage>{t(FAILURE_COPY[failure])}</ErrorMessage>}
    </Stack>
  );
}
