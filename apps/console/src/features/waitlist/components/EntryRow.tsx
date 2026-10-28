import { useFloorWaitlistActions, useWaitlistCallActions, type FloorTable, type WaitlistBoardEntry, type WaitlistFailure } from '@rivr/db';
import { formatTime, t, type MessageKey } from '@rivr/i18n';
import { Button, ErrorMessage, Inline, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { CallForm } from './CallForm.tsx';
import { BACK_FAILURE_COPY, ENTRY_FAILURE_COPY } from './failureCopy.ts';

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

type Outcome = Promise<{ ok: true } | { ok: false; error: WaitlistFailure }>;

interface EntryActionsProps {
  venueId: string;
  entry: WaitlistBoardEntry;
  onCall: () => void;
  act: (done: Outcome, copy?: Readonly<Record<WaitlistFailure, MessageKey>>) => Promise<void>;
}

/**
 * The floor's actions on one place: Call, then Seat; Skip and Back; Remove. Skip on a called member
 * ends the call, keeps their place as away, and calls the next name to the seat.
 */
function EntryActions({ venueId, entry, onCall, act }: EntryActionsProps) {
  const { remove } = useFloorWaitlistActions(venueId);
  const { seat, away } = useWaitlistCallActions();
  const name = entry.fullName;
  const skip = (
    <Button variant="text" onClick={() => void act(away.mutateAsync({ entryId: entry.entryId, isAway: true }))}>{t('console.waitlist.skip', { name })}</Button>
  );
  return (
    <Inline gap={2} wrap>
      {entry.holdUntil !== null ? (
        <>
          <Button variant="secondary" isLoading={seat.isPending} onClick={() => void act(seat.mutateAsync(entry.entryId))}>{t('console.waitlist.seat', { name })}</Button>
          {skip}
        </>
      ) : entry.awayUntil !== null ? (
        <Button variant="secondary" onClick={() => void act(away.mutateAsync({ entryId: entry.entryId, isAway: false }), BACK_FAILURE_COPY)}>
          {t('console.waitlist.back', { name })}
        </Button>
      ) : (
        <>
          <Button variant="secondary" onClick={onCall}>{t('console.waitlist.call', { name })}</Button>
          {skip}
        </>
      )}
      <Button variant="text" isLoading={remove.isPending} onClick={() => void act(remove.mutateAsync(entry.entryId))}>{t('console.waitlist.remove', { name })}</Button>
    </Inline>
  );
}

/** One place on a list: who and where they stand, the floor's actions, and the call form when calling. */
export function EntryRow({ venueId, entry, tables }: { venueId: string; entry: WaitlistBoardEntry; tables: readonly FloorTable[] }) {
  const [isCalling, setIsCalling] = useState(false);
  const [failure, setFailure] = useState<MessageKey | null>(null);
  const act = async (done: Outcome, copy: Readonly<Record<WaitlistFailure, MessageKey>> = ENTRY_FAILURE_COPY) => {
    const outcome = await done;
    setFailure(outcome.ok ? null : copy[outcome.error]);
  };
  const state = standing(entry);
  return (
    <Stack gap={3}>
      <Inline gap={4} align="center" justify="between" wrap>
        <Stack gap={1}>
          <Text>{entryLine(entry)}</Text>
          {state === null ? null : <Text variant="small">{state}</Text>}
          {entry.addedByFloor ? <Text variant="small" tone="muted">{t('console.waitlist.addedByFloor')}</Text> : null}
        </Stack>
        <EntryActions venueId={venueId} entry={entry} onCall={() => setIsCalling(true)} act={act} />
      </Inline>
      {isCalling ? <CallForm entryId={entry.entryId} name={entry.fullName} tables={tables} onDone={() => setIsCalling(false)} /> : null}
      {failure === null ? null : <ErrorMessage>{t(failure)}</ErrorMessage>}
    </Stack>
  );
}
