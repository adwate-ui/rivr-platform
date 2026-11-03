import { useFloorWaitlistActions, useWaitlistCallActions, type WaitlistBoardEntry } from '@rivr/db';
import { t } from '@rivr/i18n';
import { BulkBar, ConfirmQuestion, ErrorMessage, Stack, useToast } from '@rivr/ui';
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

/**
 * The bar over the places ticked (console v3): Hold their places, or Remove them after a question, then Clear. Says how many
 * went through in a toast; a place another step changed first stays ticked, with the failure under the bar.
 */
export function BulkPlaces({ venueId, entries, onClear }: BulkPlacesProps) {
  const { remove } = useFloorWaitlistActions(venueId);
  const { away } = useWaitlistCallActions();
  const toast = useToast();
  const [isAsking, setIsAsking] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [missed, setMissed] = useState(false);
  const run = async (step: (entry: WaitlistBoardEntry) => Promise<{ ok: boolean }>, said: (count: number) => string) => {
    setIsBusy(true);
    const done = await eachOf(entries, step);
    setIsBusy(false);
    setIsAsking(false);
    setMissed(done < entries.length);
    toast(said(done));
    if (done === entries.length) onClear();
  };
  const hold = () => void run((entry) => away.mutateAsync({ entryId: entry.entryId, isAway: true }), (count) => t('console.waitlist.toast.bulkHeld', { count }));
  const removeAll = () => void run((entry) => remove.mutateAsync(entry.entryId), (count) => t('console.waitlist.toast.bulkRemoved', { count }));
  return (
    <Stack gap={2}>
      <BulkBar count={entries.length} onClear={onClear} actions={[
        { id: 'hold', label: t('console.waitlist.card.bulkHold'), onClick: hold, isLoading: isBusy && !isAsking },
        { id: 'remove', label: t('console.waitlist.card.bulkRemove'), onClick: () => setIsAsking(true), isMain: true, tone: 'danger' },
      ]} />
      {isAsking && entries.length > 0 ? (
        <ConfirmQuestion question={t('console.waitlist.card.confirmRemoveMany', { count: entries.length })}
          confirm={t('console.waitlist.card.confirmRemoveManyYes')} isBusy={isBusy} onCancel={() => setIsAsking(false)} onConfirm={removeAll} />
      ) : null}
      {missed ? <ErrorMessage>{t('console.waitlist.changed')}</ErrorMessage> : null}
    </Stack>
  );
}
