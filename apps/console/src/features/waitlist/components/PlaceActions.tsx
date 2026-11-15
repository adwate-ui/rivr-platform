import { useFloorWaitlistActions, useWaitlistCallActions, type FloorTable, type WaitlistBoardEntry, type WaitlistFailure } from '@rivr/db';
import { t, type MessageKey } from '@rivr/i18n';
import { Box, Button, ConfirmQuestion, Inline, OverflowMenu, useToast, type OverflowMenuItem } from '@rivr/ui';
import { CALL_FAILURE_COPY, RELEASE_FAILURE_COPY, ENTRY_FAILURE_COPY } from './failureCopy.ts';

type Outcome = { ok: true } | { ok: false; error: WaitlistFailure };

/** What a step asks first, under its row: Remove always; Hold on a called place, as it ends the call. */
export type Asking = 'hold' | 'remove';

/** The place's steps: Call, Hold place or Release, and Remove, each saying its outcome in a toast, or its failure to `onOutcome`, which the row shows under itself. */
function usePlaceSteps(venueId: string, entry: WaitlistBoardEntry, onOutcome: (failure: MessageKey | null) => void) {
  const { remove } = useFloorWaitlistActions(venueId);
  const { call, away } = useWaitlistCallActions();
  const toast = useToast();
  const name = entry.fullName;
  const run = async (step: Promise<Outcome>, said: string, copy = ENTRY_FAILURE_COPY, onUndo?: () => void) => {
    const outcome = await step;
    onOutcome(outcome.ok ? null : copy[outcome.error]);
    if (outcome.ok) toast(said, onUndo === undefined ? undefined : { onUndo });
  };
  const setAway = (isAway: boolean) => away.mutateAsync({ entryId: entry.entryId, isAway });
  const held = t('console.waitlist.toast.held', { name });
  const released = t('console.waitlist.toast.released', { name });
  // Undo goes through the same step, so a refused Undo (the place called or seated meanwhile) says so under the row.
  const holdNow = () => run(setAway(true), held, ENTRY_FAILURE_COPY);
  const releaseNow = () => run(setAway(false), released, RELEASE_FAILURE_COPY);
  return {
    isBusy: call.isPending || away.isPending || remove.isPending,
    // Hold and Release undo each other exactly; holding a called place also ends its call, which Release does not bring back.
    hold: () => run(setAway(true), held, ENTRY_FAILURE_COPY, entry.holdUntil === null ? () => void releaseNow() : undefined),
    release: () => void run(setAway(false), released, RELEASE_FAILURE_COPY, () => void holdNow()),
    remove: () => run(remove.mutateAsync(entry.entryId), t('console.waitlist.toast.removed', { name })),
    call: () => void run(call.mutateAsync(entry.entryId), t('console.waitlist.toast.called', { name }), CALL_FAILURE_COPY),
  };
}

type Steps = ReturnType<typeof usePlaceSteps>;

/**
 * The ⋯ menu: Hold place, or Release for a place held, then Remove from list. Remove asks first; so does Hold on a called
 * place, as it ends the call, with no Undo.
 */
function menuItems(entry: WaitlistBoardEntry, steps: Steps, ask: (what: Asking) => void): OverflowMenuItem[] {
  const isHeld = entry.awayUntil !== null;
  const hold = entry.holdUntil === null ? () => void steps.hold() : () => ask('hold');
  return [
    isHeld ? { id: 'release', label: t('console.waitlist.card.release'), onSelect: steps.release } : { id: 'hold', label: t('console.waitlist.card.hold'), onSelect: hold },
    { id: 'remove', label: t('console.waitlist.card.removeFromList'), onSelect: () => ask('remove'), tone: 'danger' },
  ];
}

interface PlaceActionsProps {
  venueId: string;
  entry: WaitlistBoardEntry;
  /** The table whose list the place is on: Seat opens its sheet while it is open. */
  table: FloorTable;
  /** Opens the sheet that seats the place at its table. */
  onSeat: () => void;
  /** Opens the check in person for a member whose identity check waits for the desk (decision 0503); none for staff who cannot. */
  onCheckId?: (() => void) | undefined;
  /** A step that asks first: the question opens under the row. */
  onAsk: (what: Asking) => void;
  /** How the last step went: why it failed, or null once one goes through. */
  onOutcome: (failure: MessageKey | null) => void;
}

/**
 * The row's one button: Check ID while the member's identity check waits for the desk (decision 0503), which opens the
 * check in person for them; otherwise Seat, which opens the seat sheet while the table is open, at the seat held for a
 * member called. None for a closed or full table's place not called (audit F-030).
 */
function mainAction({ entry, table, onSeat, onCheckId }: PlaceActionsProps, isBusy: boolean) {
  const name = entry.fullName;
  if (entry.needsIdCheck) return onCheckId === undefined ? null : { label: t('console.waitlist.checkIdShort'), name: t('console.waitlist.checkId', { name }), isLoading: false, onClick: onCheckId };
  const isCalled = entry.holdUntil !== null;
  if (!isCalled && (!table.isOpen || table.openSeats === 0)) return null;
  return { label: t('console.waitlist.seatShort'), name: t('console.waitlist.seat', { name }), isLoading: isBusy, onClick: onSeat };
}

/** Whether Call is offered (the owner, 8 Nov): for a member waiting with a seat free for them; it holds the seat and tells them. */
const canCall = ({ entry, table }: PlaceActionsProps) =>
  entry.holdUntil === null && entry.awayUntil === null && !entry.needsIdCheck && table.isOpen && table.openSeats !== 0;

/** A place's steps on its row (redesign RD-31): Seat or Check ID, Call, and the ⋯ menu to hold, release or remove it. */
export function PlaceActions(props: PlaceActionsProps) {
  const { venueId, entry, onAsk, onOutcome } = props;
  const steps = usePlaceSteps(venueId, entry, onOutcome);
  const name = entry.fullName;
  const main = mainAction(props, steps.isBusy);
  return (
    <Inline gap={2} align="center" justify="end">
      {canCall(props) ? (
        <Button variant="subtle" size="small" aria-label={t('console.waitlist.call', { name })} isLoading={steps.isBusy} onClick={steps.call}>{t('console.waitlist.callShort')}</Button>
      ) : null}
      {main === null ? null : <Button variant="strong" size="small" aria-label={main.name} isLoading={main.isLoading} onClick={main.onClick}>{main.label}</Button>}
      <OverflowMenu label={t('console.waitlist.card.more', { name })} items={menuItems(entry, steps, onAsk)} />
    </Inline>
  );
}

/** The question a step asks first, under its row: Remove, or Hold on a called place. */
export function PlaceQuestion({ venueId, entry, asking, onDone, onOutcome }: {
  venueId: string; entry: WaitlistBoardEntry; asking: Asking; onDone: () => void; onOutcome: (failure: MessageKey | null) => void;
}) {
  const steps = usePlaceSteps(venueId, entry, onOutcome);
  const isRemove = asking === 'remove';
  const name = entry.fullName;
  return (
    <Box paddingX={4} paddingY={2}>
      <ConfirmQuestion question={t(isRemove ? 'console.waitlist.card.confirmRemove' : 'console.waitlist.card.confirmHoldCalled', { name })}
        confirm={t(isRemove ? 'console.waitlist.confirmRemove' : 'console.waitlist.confirmSkip', { name })} isBusy={steps.isBusy} onCancel={onDone}
        onConfirm={() => void (isRemove ? steps.remove() : steps.hold()).then(onDone)} />
    </Box>
  );
}
