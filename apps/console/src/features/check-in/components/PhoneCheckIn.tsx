import { zodResolver } from '@hookform/resolvers/zod';
import { doorCheckInSchema } from '@rivr/contracts';
import { useCheckInActions, type CheckInFailure } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, ErrorMessage, Inline, Input, Stack } from '@rivr/ui';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { CHECK_IN_FAILURE_COPY } from './checkInCopy.ts';

/** Checks a member in by their mobile number, when they do not have their card to hand. */
export function PhoneCheckIn({ venueId }: { venueId: string }) {
  const { checkInByPhone } = useCheckInActions(venueId);
  const [failure, setFailure] = useState<CheckInFailure | null>(null);
  const [resolver] = useState(() => zodResolver(doorCheckInSchema));
  const form = useForm<z.input<typeof doorCheckInSchema>, unknown, z.output<typeof doorCheckInSchema>>({ resolver, defaultValues: { phone: '' } });
  const submit = form.handleSubmit(async ({ phone }) => {
    const opened = await checkInByPhone.mutateAsync(phone);
    setFailure(opened.ok ? null : opened.error);
    if (opened.ok) form.reset();
  });
  const phone = form.register('phone');
  return (
    <Stack gap={2}>
      <Inline gap={3} align="end">
        <Input {...phone} type="tel" label={t('console.checkIn.phone')} prefix={t('common.signIn.countryCode')} inputMode="tel" autoComplete="off" />
        <Button variant="secondary" isLoading={checkInByPhone.isPending} onClick={() => void submit()}>{t('console.checkIn.checkIn')}</Button>
      </Inline>
      {form.formState.errors.phone ? <ErrorMessage>{t('console.checkIn.invalid')}</ErrorMessage> : null}
      {failure === null ? null : <ErrorMessage>{t(CHECK_IN_FAILURE_COPY[failure])}</ErrorMessage>}
    </Stack>
  );
}
