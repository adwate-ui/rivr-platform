import { zodResolver } from '@hookform/resolvers/zod';
import { floorWaitlistAddSchema } from '@rivr/contracts';
import { useFloorWaitlistActions, type WaitlistFailure } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, ErrorMessage, Inline, Input, Stack } from '@rivr/ui';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { FAILURE_COPY } from './failureCopy.ts';

/**
 * Adds a member to one list by their mobile number. A new request id for each number added, so a
 * retried tap adds the member once and the next number is a new request.
 */
export function AddMemberForm({ venueId, tableTypeId }: { venueId: string; tableTypeId: string }) {
  const { add } = useFloorWaitlistActions(venueId);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [failure, setFailure] = useState<WaitlistFailure | null>(null);
  const [resolver] = useState(() => zodResolver(floorWaitlistAddSchema));
  const form = useForm<z.input<typeof floorWaitlistAddSchema>, unknown, z.output<typeof floorWaitlistAddSchema>>({
    resolver, defaultValues: { phone: '' },
  });
  const submit = form.handleSubmit(async ({ phone }) => {
    const added = await add.mutateAsync({ tableTypeId, phone, requestId });
    setFailure(added.ok ? null : added.error);
    if (added.ok) {
      form.reset();
      setRequestId(crypto.randomUUID());
    }
  });
  const phone = form.register('phone', { onChange: () => setRequestId(crypto.randomUUID()) });
  return (
    <Stack gap={2}>
      <Inline gap={3} align="end">
        <Input {...phone} type="tel" label={t('console.waitlist.phone')} prefix={t('common.signIn.countryCode')} inputMode="tel" autoComplete="off" />
        <Button variant="secondary" isLoading={add.isPending} onClick={() => void submit()}>{t('console.waitlist.add')}</Button>
      </Inline>
      {form.formState.errors.phone ? <ErrorMessage>{t('console.waitlist.invalid')}</ErrorMessage> : null}
      {failure === null ? null : <ErrorMessage>{t(FAILURE_COPY[failure])}</ErrorMessage>}
    </Stack>
  );
}
