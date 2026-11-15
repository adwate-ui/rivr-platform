import { zodResolver } from '@hookform/resolvers/zod';
import { floorWaitlistAddSchema } from '@rivr/contracts';
import { useFloorWaitlistActions, type WaitlistFailure } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, ErrorMessage, Inline, Input, Sheet, Stack, useToast } from '@rivr/ui';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { FAILURE_COPY } from './failureCopy.ts';

interface AddPlaceSheetProps {
  venueId: string;
  table: { id: string; name: string };
  onClose: () => void;
}

/**
 * Adds a member to one table's list (decision 0467) by their mobile number or membership number, in the panel at the side
 * (redesign RD-38). One request id for the number as typed, so a retried tap adds the member once; a number changed is a
 * new request. Added, it says so in a toast and closes.
 */
function AddPlaceSheet({ venueId, table, onClose }: AddPlaceSheetProps) {
  const { add } = useFloorWaitlistActions(venueId);
  const toast = useToast();
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [failure, setFailure] = useState<WaitlistFailure | null>(null);
  const [resolver] = useState(() => zodResolver(floorWaitlistAddSchema));
  const form = useForm<z.input<typeof floorWaitlistAddSchema>, unknown, z.output<typeof floorWaitlistAddSchema>>({
    resolver, defaultValues: { number: '' },
  });
  const submit = form.handleSubmit(async ({ number }) => {
    const added = await add.mutateAsync({ tableId: table.id, who: number, requestId });
    setFailure(added.ok ? null : added.error);
    if (!added.ok) return;
    toast(t('console.waitlist.toast.added', { table: table.name }));
    onClose();
  });
  const field = form.register('number', { onChange: () => setRequestId(crypto.randomUUID()) });
  const footer = (
    <Inline gap={2} justify="end">
      <Button variant="text" size="compact" onClick={onClose}>{t('common.cancel')}</Button>
      <Button variant="primary" size="compact" isLoading={form.formState.isSubmitting || add.isPending} onClick={() => void submit()}>
        {t('console.waitlist.card.addShort')}
      </Button>
    </Inline>
  );
  return (
    <Sheet place="console" isOpen onClose={onClose} footer={footer} title={t('console.waitlist.card.addTo', { table: table.name })}>
      <Stack gap={3}>
        <Input {...field} label={t('console.waitlist.card.add')} inputMode="numeric" autoComplete="off"
          error={form.formState.errors.number ? t('console.waitlist.card.addInvalid') : undefined}
          onKeyDown={(event) => { if (event.key === 'Enter') void submit(); }} />
        {failure === null ? null : <ErrorMessage>{t(FAILURE_COPY[failure])}</ErrorMessage>}
      </Stack>
    </Sheet>
  );
}

/** Add, on a table's list: it opens the panel for that table, a fresh one each time. */
export function AddPlaceForm({ venueId, table }: { venueId: string; table: { id: string; name: string } }) {
  const [opened, setOpened] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  return (
    <Inline>
      <Button variant="text" size="compact" aria-label={t('console.waitlist.card.addTo', { table: table.name })} onClick={() => { setOpened(opened + 1); setIsOpen(true); }}>
        {t('console.waitlist.card.addShort')}
      </Button>
      {isOpen ? <AddPlaceSheet key={opened} venueId={venueId} table={table} onClose={() => setIsOpen(false)} /> : null}
    </Inline>
  );
}
