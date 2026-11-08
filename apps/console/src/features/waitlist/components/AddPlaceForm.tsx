import { zodResolver } from '@hookform/resolvers/zod';
import { floorWaitlistAddSchema } from '@rivr/contracts';
import { useFloorWaitlistActions, type WaitlistFailure } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, ErrorMessage, Inline, Input, Stack, useToast } from '@rivr/ui';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { FAILURE_COPY } from './failureCopy.ts';

/**
 * Adds a member to one table's list (decision 0467) by their mobile number or membership number (console v3). A new
 * request id for each number added, so a retried tap adds the member once and the next number is a new request.
 */
export function AddPlaceForm({ venueId, table }: { venueId: string; table: { id: string; name: string } }) {
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
    form.reset();
    setRequestId(crypto.randomUUID());
  });
  const field = form.register('number', { onChange: () => setRequestId(crypto.randomUUID()) });
  return (
    <Stack gap={2}>
      <Inline gap={2} align="end">
        <Input {...field} variant="subtle" label={t('console.waitlist.card.add')} inputMode="numeric" autoComplete="off"
          onKeyDown={(event) => { if (event.key === 'Enter') void submit(); }} />
        <Button variant="text" size="compact" isLoading={form.formState.isSubmitting || add.isPending} onClick={() => void submit()}>
          {t('console.waitlist.card.addShort')}
        </Button>
      </Inline>
      {form.formState.errors.number ? <ErrorMessage>{t('console.waitlist.card.addInvalid')}</ErrorMessage> : null}
      {failure === null ? null : <ErrorMessage>{t(FAILURE_COPY[failure])}</ErrorMessage>}
    </Stack>
  );
}
