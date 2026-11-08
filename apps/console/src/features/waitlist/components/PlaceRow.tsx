import { useFloorWaitlistActions, useWaitlistCallActions, type FloorTable, type WaitlistBoardEntry, type WaitlistFailure } from '@rivr/db';
import { t, type MessageKey } from '@rivr/i18n';
import { Box, ConfirmQuestion, ErrorMessage, Stack, useTableDensity, useToast, WaitlistRow, type OverflowMenuItem } from '@rivr/ui';
import { useState } from 'react';
import { RELEASE_FAILURE_COPY, ENTRY_FAILURE_COPY } from './failureCopy.ts';
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
  /** Opens the check in person for a member whose identity check waits for the desk (decision 0503); none for staff who cannot. */
  onCheckId?: (() => void) | undefined;
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
  const held = t('console.waitlist.toast.held', { name });
  const released = t('console.waitlist.toast.released', { name });
  // Undo goes through the same step, so a refused Undo (the place called or seated meanwhile) says so under the row.
  const holdNow = () => run(setAway(true), held, ENTRY_FAILURE_COPY);
  const releaseNow = () => run(setAway(false), released, RELEASE_FAILURE_COPY);
  return {
    failure,
    isBusy: seat.isPending || away.isPending || remove.isPending,
    // Hold and Release undo each other exactly; holding a called place also ends its call, which Release does not bring back.
    hold: () => run(setAway(true), held, ENTRY_FAILURE_COPY, entry.holdUntil === null ? () => void releaseNow() : undefined),
    release: () => void run(setAway(false), released, RELEASE_FAILURE_COPY, () => void holdNow()),
    seatCalled: () => void run(seat.mutateAsync(entry.entryId),
      t('console.waitlist.toast.seated', { name, table: entry.callTableName ?? '', seat: entry.callSeat ?? 0 })),
    remove: () => run(remove.mutateAsync(entry.entryId), t('console.waitlist.toast.removed', { name })),
  };
}

type Asking = 'hold' | 'remove' | null;

/**
 * The ⋯ menu: Hold place, or Release for a place held, then Remove from list. Remove asks first; so does Hold on a called
 * place, as it ends the call and calls the next name, with no Undo.
 */
function menuItems(entry: WaitlistBoardEntry, steps: ReturnType<typeof usePlaceSteps>, ask: (what: Asking) => void): OverflowMenuItem[] {
  const isHeld = entry.awayUntil !== null;
  const hold = entry.holdUntil === null ? () => void steps.hold() : () => ask('hold');
  return [
    isHeld ? { id: 'release', label: t('console.waitlist.card.release'), onSelect: steps.release } : { id: 'hold', label: t('console.waitlist.card.hold'), onSelect: hold },
    { id: 'remove', label: t('console.waitlist.card.removeFromList'), onSelect: () => ask('remove'), tone: 'danger' },
  ];
}

/** The question a step asks first under its row: Remove, or Hold on a called place. */
function StepQuestion({ asking, name, steps, onDone }: { asking: Exclude<Asking, null>; name: string; steps: ReturnType<typeof usePlaceSteps>; onDone: () => void }) {
  const isRemove = asking === 'remove';
  return (
    <Box paddingX={4} paddingY={2}>
      <ConfirmQuestion question={t(isRemove ? 'console.waitlist.card.confirmRemove' : 'console.waitlist.card.confirmHoldCalled', { name })}
        confirm={t(isRemove ? 'console.waitlist.confirmRemove' : 'console.waitlist.confirmSkip', { name })} isBusy={steps.isBusy} onCancel={onDone}
        onConfirm={() => void (isRemove ? steps.remove() : steps.hold()).then(onDone)} />
    </Box>
  );
}

/**
 * The row's one button: Check ID while the member's identity check waits for the desk (decision 0503), which opens the
 * check in person for them; otherwise Seat, which seats a called member at the seat held for them and opens the seat sheet
 * for anyone else while the table is open. None for a closed table's place not called.
 */
function rowAction({ entry, table, onSeat, onCheckId }: PlaceRowProps, steps: ReturnType<typeof usePlaceSteps>) {
  const name = entry.fullName;
  if (entry.needsIdCheck) return onCheckId === undefined ? undefined : { label: t('console.waitlist.checkIdShort'), name: t('console.waitlist.checkId', { name }), onClick: onCheckId };
  const isCalled = entry.holdUntil !== null;
  if (!isCalled && !table.isOpen) return undefined;
  return { label: t('console.waitlist.seatShort'), name: t('console.waitlist.seat', { name }), isLoading: steps.isBusy,
    onClick: isCalled ? steps.seatCalled : onSeat };
}

/** One place on a table's list (console v3): its tick for the bulk bar, its number, who and how long, its button, and the ⋯ menu. */
export function PlaceRow(props: PlaceRowProps) {
  const { venueId, entry, now, isTicked, onToggle, onCheckId } = props;
  const steps = usePlaceSteps(venueId, entry);
  const density = useTableDensity();
  const [asking, setAsking] = useState<Asking>(null);
  const name = entry.fullName;
  // No Check ID of their own (a cashier): the state in words, and no dead button (audit F-014).
  const meta = entry.needsIdCheck && onCheckId === undefined ? t('console.waitlist.metaIdAtDesk', { meta: placeMeta(entry, now) }) : placeMeta(entry, now);
  return (
    <Stack gap={2}>
      <WaitlistRow position={entry.place} name={name} meta={meta} isHeld={entry.awayUntil !== null} density={density}
        tick={{ label: t('console.waitlist.card.select', { name }), isTicked, onToggle }}
        action={rowAction(props, steps)}
        menu={{ label: t('console.waitlist.card.more', { name }), items: menuItems(entry, steps, setAsking) }} />
      {asking === null ? null : <StepQuestion asking={asking} name={name} steps={steps} onDone={() => setAsking(null)} />}
      {steps.failure === null ? null : <Box paddingX={4}><ErrorMessage>{t(steps.failure)}</ErrorMessage></Box>}
    </Stack>
  );
}
