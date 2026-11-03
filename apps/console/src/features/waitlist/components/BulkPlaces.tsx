import { useFloorWaitlistActions, useWaitlistCallActions, type WaitlistBoardEntry } from '@rivr/db';
import { t } from '@rivr/i18n';
import { BulkBar, ConfirmQuestion, ErrorMessage, useToast } from '@rivr/ui';
import { useState } from 'react';

interface BulkPlacesProps {
  venueId: string;
  /** The places ticked, on any table's list. */
  entries: readonly WaitlistBoardEntry[];
  onClear: () => void;
}

/** Runs one step on each place, and how many it went through for. */
async function eachOf(entries: readonly WaitlistBoardEntry[], step: (entry: WaitlistBoardEntry) => Promise<{ ok: boolean }>): Promise<number> {
  const outcomes = await Promise.all(entries.map(step));
  return outcomes.filter((outcome) => outcome.ok).length;
}

type Asking = 'hold' | 'remove' | null;

/** The question a bulk step asks first: Remove always, Hold when a place ticked is called (its call ends, with no Undo). */
function BulkQuestion({ asking, count, isBusy, onConfirm, onCancel }: { asking: Exclude<Asking, null>; count: number; isBusy: boolean; onConfirm: () => void; onCancel: () => void }) {
  const isRemove = asking === 'remove';
  return (
    <ConfirmQuestion question={isRemove ? t('console.waitlist.card.confirmRemoveMany', { count }) : t('console.waitlist.card.confirmHoldCalledMany')}
      confirm={t(isRemove ? 'console.waitlist.card.confirmRemoveManyYes' : 'console.waitlist.card.confirmHoldMany')} isBusy={isBusy}
      onCancel={onCancel} onConfirm={onConfirm} />
  );
}

/**
 * The bar over the places ticked (console v3): Hold their places, or Remove them, then Clear. Remove asks first, and so does
 * Hold when a place ticked is called. Says how many went through in a toast; a place another step changed first stays
 * ticked, with the failure under the bar. A fragment, so the bar sticks within the list it sits over.
 */
export function BulkPlaces({ venueId, entries, onClear }: BulkPlacesProps) {
  const { remove } = useFloorWaitlistActions(venueId);
  const { away } = useWaitlistCallActions();
  const toast = useToast();
  const [asking, setAsking] = useState<Asking>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [missed, setMissed] = useState(false);
  const run = async (step: (entry: WaitlistBoardEntry) => Promise<{ ok: boolean }>, said: (count: number) => string) => {
    setIsBusy(true);
    const done = await eachOf(entries, step);
    setIsBusy(false);
    setAsking(null);
    setMissed(done < entries.length);
    toast(said(done));
    if (done === entries.length) onClear();
  };
  const holdAll = () => void run((entry) => away.mutateAsync({ entryId: entry.entryId, isAway: true }), (count) => t('console.waitlist.toast.bulkHeld', { count }));
  const removeAll = () => void run((entry) => remove.mutateAsync(entry.entryId), (count) => t('console.waitlist.toast.bulkRemoved', { count }));
  const hasCalled = entries.some((entry) => entry.holdUntil !== null);
  return (
    <>
      <BulkBar count={entries.length} onClear={onClear} actions={[
        { id: 'hold', label: t('console.waitlist.card.bulkHold'), onClick: hasCalled ? () => setAsking('hold') : holdAll, isLoading: isBusy && asking === null },
        { id: 'remove', label: t('console.waitlist.card.bulkRemove'), onClick: () => setAsking('remove'), isMain: true, tone: 'danger' },
      ]} />
      {asking !== null && entries.length > 0 ? (
        <BulkQuestion asking={asking} count={entries.length} isBusy={isBusy} onCancel={() => setAsking(null)} onConfirm={asking === 'remove' ? removeAll : holdAll} />
      ) : null}
      {missed ? <ErrorMessage>{t('console.waitlist.changed')}</ErrorMessage> : null}
    </>
  );
}
