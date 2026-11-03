import { useFloorWaitlistActions, useWaitlistCallActions, type FloorTable, type WaitlistBoardEntry, type WaitlistFailure } from '@rivr/db';
import { formatTime, t, type MessageKey } from '@rivr/i18n';
import { Button, ConfirmButton, ErrorMessage, Inline, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { AssignForm } from './AssignForm.tsx';
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
    const called = t('console.waitlist.called', { table: entry.callTableName ?? '', seat: entry.callSeat ?? 0, time: at(entry.holdUntil) });
    // The member said "I'm on my way" from the app (decision 0321).
    return entry.onWayAt === null ? called : `${called} · ${t('console.waitlist.onTheWay')}`;
  }
  return entry.awayUntil === null ? null : t('console.waitlist.away', { time: at(entry.awayUntil) });
}

type Outcome = Promise<{ ok: true } | { ok: false; error: WaitlistFailure }>;

interface EntryActionsProps {
  venueId: string;
  entry: WaitlistBoardEntry;
  onCall: () => void;
  /** Whether the game has an open table to call to (F2-18). */
  canCall: boolean;
  act: (done: Outcome, copy?: Readonly<Record<WaitlistFailure, MessageKey>>) => Promise<void>;
}

/**
 * The floor's actions on one place: Assign, which seats the member at once (decision 0299); Seat for a place called by
 * the roll-on; Hold place and Back; Remove. Hold place on a called member ends the call, keeps their place as away, and
 * calls the next name to the seat. Each shows its verb, the name on the row beside it, and carries the name for a screen
 * reader (UI polish audit A-09).
 */
function EntryActions({ venueId, entry, onCall, canCall, act }: EntryActionsProps) {
  const { remove } = useFloorWaitlistActions(venueId);
  const { seat, away } = useWaitlistCallActions();
  const name = entry.fullName;
  const skip = (
    <ConfirmButton label={t('console.waitlist.skipShort')} name={t('console.waitlist.skip', { name })} confirm={t('console.waitlist.confirmSkip', { name })}
      onConfirm={() => void act(away.mutateAsync({ entryId: entry.entryId, isAway: true }))} />
  );
  return (
    <Inline gap={2} wrap>
      {entry.holdUntil !== null ? (
        <>
          <Button variant="secondary" aria-label={t('console.waitlist.seat', { name })} isLoading={seat.isPending} onClick={() => void act(seat.mutateAsync(entry.entryId))}>
            {t('console.waitlist.seatShort')}
          </Button>
          {skip}
        </>
      ) : entry.awayUntil !== null ? (
        <Button variant="secondary" aria-label={t('console.waitlist.back', { name })} isLoading={away.isPending}
          onClick={() => void act(away.mutateAsync({ entryId: entry.entryId, isAway: false }), BACK_FAILURE_COPY)}>
          {t('console.waitlist.backShort')}
        </Button>
      ) : (
        <>
          {/* No assignment without an open table of the game (F2-18). */}
          {canCall ? <Button variant="secondary" aria-label={t('console.waitlist.call', { name })} onClick={onCall}>{t('console.waitlist.callShort')}</Button> : null}
          {skip}
        </>
      )}
      <ConfirmButton label={t('console.waitlist.removeShort')} name={t('console.waitlist.remove', { name })} confirm={t('console.waitlist.confirmRemove', { name })} isBusy={remove.isPending}
        onConfirm={() => void act(remove.mutateAsync(entry.entryId))} />
    </Inline>
  );
}

/** One place on a list: who and where they stand, the floor's actions, and the assign form when assigning. */
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
        <EntryActions venueId={venueId} entry={entry} onCall={() => setIsCalling(true)} canCall={tables.length > 0} act={act} />
      </Inline>
      {isCalling ? <AssignForm venueId={venueId} entryId={entry.entryId} name={entry.fullName} tables={tables} askedTableId={entry.tableId}
        onDone={() => setIsCalling(false)} /> : null}
      {failure === null ? null : <ErrorMessage>{t(failure)}</ErrorMessage>}
    </Stack>
  );
}
