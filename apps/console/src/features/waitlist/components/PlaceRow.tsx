import { useFloorWaitlistActions, useWaitlistCallActions, type FloorTable, type WaitlistBoardEntry, type WaitlistFailure } from '@rivr/db';
import { t, type MessageKey } from '@rivr/i18n';
import { Box, ConfirmQuestion, ErrorMessage, Stack, useToast, WaitlistRow, type OverflowMenuItem } from '@rivr/ui';
import { useState } from 'react';
import { BACK_FAILURE_COPY, ENTRY_FAILURE_COPY } from './failureCopy.ts';
import { placeMeta } from './placeMeta.ts';

type Outcome = { ok: true } | { ok: false; error: WaitlistFailure };

interface PlaceRowProps {
  venueId: string;
  entry: WaitlistBoardEntry;
  /** The table whose list it is: Seat opens its sheet while it is open. */
  table: FloorTable;
  now: Date;
  isTicked: boolean;
  onToggle: () => void;
  /** Opens the sheet that seats the place at its table. */
  onSeat: () => void;
}

/** The place's steps: Seat, Hold place or Release, and Remove, each saying its outcome in a toast or its failure under the row. */
function usePlaceSteps(venueId: string, entry: WaitlistBoardEntry) {
  const { remove } = useFloorWaitlistActions(venueId);
  const { seat, away } = useWaitlistCallActions();
  const toast = useToast();
  const [failure, setFailure] = useState<MessageKey | null>(null);
  const name = entry.fullName;
  const run = async (step: Promise<Outcome>, said: string, copy = ENTRY_FAILURE_COPY, onUndo?: () => void) => {
    const outcome = await step;
    setFailure(outcome.ok ? null : copy[outcome.error]);
    if (outcome.ok) toast(said, onUndo === undefined ? undefined : { onUndo });
  };
  const setAway = (isAway: boolean) => away.mutateAsync({ entryId: entry.entryId, isAway });
  return {
    failure,
    isBusy: seat.isPending || away.isPending || remove.isPending,
    // Hold and Release undo each other exactly; holding a called place also ends its call, which Release does not bring back.
    hold: () => void run(setAway(true), t('console.waitlist.toast.held', { name }), ENTRY_FAILURE_COPY,
      entry.holdUntil === null ? () => void setAway(false) : undefined),
    release: () => void run(setAway(false), t('console.waitlist.toast.released', { name }), BACK_FAILURE_COPY, () => void setAway(true)),
    seatCalled: () => void run(seat.mutateAsync(entry.entryId),
      t('console.waitlist.toast.seated', { name, table: entry.callTableName ?? '', seat: entry.callSeat ?? 0 })),
    remove: () => run(remove.mutateAsync(entry.entryId), t('console.waitlist.toast.removed', { name })),
  };
}

/** The ⋯ menu: Hold place, or Release for a place held, then Remove from list. */
function menuItems(entry: WaitlistBoardEntry, steps: ReturnType<typeof usePlaceSteps>, askRemove: () => void): OverflowMenuItem[] {
  const isHeld = entry.awayUntil !== null;
  return [
    isHeld ? { id: 'release', label: t('console.waitlist.card.release'), onSelect: steps.release } : { id: 'hold', label: t('console.waitlist.card.hold'), onSelect: steps.hold },
    { id: 'remove', label: t('console.waitlist.card.removeFromList'), onSelect: askRemove, tone: 'danger' },
  ];
}

/**
 * One place on a table's list (console v3): its tick for the bulk bar, its number, who and how long, Seat, and the ⋯ menu.
 * Seat seats a called member at the seat held for them, and opens the seat sheet for anyone else while the table is open.
 */
export function PlaceRow({ venueId, entry, table, now, isTicked, onToggle, onSeat }: PlaceRowProps) {
  const steps = usePlaceSteps(venueId, entry);
  const [isRemoving, setIsRemoving] = useState(false);
  const name = entry.fullName;
  const isCalled = entry.holdUntil !== null;
  const canSeat = isCalled || table.isOpen;
  return (
    <Stack gap={2}>
      <WaitlistRow position={entry.place} name={name} meta={placeMeta(entry, now)} isHeld={entry.awayUntil !== null}
        tick={{ label: t('console.waitlist.card.select', { name }), isTicked, onToggle }}
        action={canSeat ? { label: t('console.waitlist.seatShort'), name: t('console.waitlist.seat', { name }), isLoading: steps.isBusy,
          onClick: isCalled ? steps.seatCalled : onSeat } : undefined}
        menu={{ label: t('console.waitlist.card.more', { name }), items: menuItems(entry, steps, () => setIsRemoving(true)) }} />
      {isRemoving ? (
        <Box paddingX={4} paddingY={2}>
          <ConfirmQuestion question={t('console.waitlist.card.confirmRemove', { name })} confirm={t('console.waitlist.confirmRemove', { name })}
            isBusy={steps.isBusy} onCancel={() => setIsRemoving(false)} onConfirm={() => void steps.remove().then(() => setIsRemoving(false))} />
        </Box>
      ) : null}
      {steps.failure === null ? null : <Box paddingX={4}><ErrorMessage>{t(steps.failure)}</ErrorMessage></Box>}
    </Stack>
  );
}
