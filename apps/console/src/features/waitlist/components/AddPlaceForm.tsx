import { zodResolver } from '@hookform/resolvers/zod';
import { floorWaitlistAddSchema } from '@rivr/contracts';
import { useFloorWaitlistActions, type WaitlistFailure } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, ChoiceChips, ErrorMessage, Inline, Input, Sheet, Stack, useToast } from '@rivr/ui';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { FAILURE_COPY } from './failureCopy.ts';

/** A table with a list, to add a member to. */
interface ListTable { readonly id: string; readonly name: string }

interface AddPlaceSheetProps {
  venueId: string;
  /** The tables with a list (decision 0467); the first is chosen until another is. */
  tables: readonly ListTable[];
  onClose: () => void;
}

/**
 * Adds a member to one table's list (decision 0467) by their mobile number or membership number, in the panel at the side
 * (redesign RD-38), with the table chosen there (redesign RD-31). One request id for the number and table as chosen, so a
 * retried tap adds the member once; either changed is a new request. Added, it says so in a toast and closes.
 */
function AddPlaceSheet({ venueId, tables, onClose }: AddPlaceSheetProps) {
  const { add } = useFloorWaitlistActions(venueId);
  const toast = useToast();
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [failure, setFailure] = useState<WaitlistFailure | null>(null);
  const [tableId, setTableId] = useState(tables[0]?.id ?? '');
  const table = tables.find((one) => one.id === tableId);
  const [resolver] = useState(() => zodResolver(floorWaitlistAddSchema));
  const form = useForm<z.input<typeof floorWaitlistAddSchema>, unknown, z.output<typeof floorWaitlistAddSchema>>({ resolver, defaultValues: { number: '' } });
  const submit = form.handleSubmit(async ({ number }) => {
    if (table === undefined) return;
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
    <Sheet place="console" isOpen onClose={onClose} footer={footer} title={t('console.waitlist.card.addToList')}>
      <Stack gap={4}>
        <Input {...field} label={t('console.waitlist.card.add')} inputMode="numeric" autoComplete="off"
          error={form.formState.errors.number ? t('console.waitlist.card.addInvalid') : undefined}
          onKeyDown={(event) => { if (event.key === 'Enter') void submit(); }} />
        <ChoiceChips label={t('console.waitlist.table.table')} mode="one" selected={[tableId]} options={tables.map(({ id, name }) => ({ value: id, label: name }))}
          onChange={([picked]) => { if (picked !== undefined) { setTableId(picked); setRequestId(crypto.randomUUID()); } }} />
        {failure === null ? null : <ErrorMessage>{t(FAILURE_COPY[failure])}</ErrorMessage>}
      </Stack>
    </Sheet>
  );
}

/** Add to a list, in the Waitlist's title row: it opens the panel, a fresh one each time. Nothing while no table has a list. */
export function AddPlaceForm({ venueId, tables }: { venueId: string; tables: readonly ListTable[] }) {
  const [opened, setOpened] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  if (tables.length === 0) return null;
  return (
    <>
      <Button variant="primary" size="compact" onClick={() => { setOpened(opened + 1); setIsOpen(true); }}>{t('console.waitlist.card.addToList')}</Button>
      {isOpen ? <AddPlaceSheet key={opened} venueId={venueId} tables={tables} onClose={() => setIsOpen(false)} /> : null}
    </>
  );
}
