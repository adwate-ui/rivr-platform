import { zodResolver } from '@hookform/resolvers/zod';
import { doorCheckInSchema } from '@rivr/contracts';
import { useCheckInActions, useCheckOutActions, type CheckInFailure, type CheckOutRefusal } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, ErrorMessage, Inline, Input, Stack, StatusMessage, Text } from '@rivr/ui';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { CHECK_IN_FAILURE_COPY, checkOutRefusalText } from './checkInCopy.ts';

type Outcome = { in: CheckInFailure } | { out: CheckOutRefusal } | 'checked_in' | 'checked_out' | null;

/**
 * Checks a member in, or out as they leave (#82), by their mobile number, when they do not have their
 * card to hand (#71).
 */
/** True for two seconds after a check-in or out goes through: a second tap then, on the emptied field, keeps its line. */
function useJustDone(): [boolean, () => void] {
  const [isJustDone, setJustDone] = useState(false);
  return [isJustDone, () => {
    setJustDone(true);
    setTimeout(() => setJustDone(false), 2000);
  }];
}

export function PhoneCheckIn({ venueId }: { venueId: string }) {
  const { checkInByPhone } = useCheckInActions(venueId);
  const { checkOutByPhone } = useCheckOutActions(venueId);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [isJustDone, markDone] = useJustDone();
  const succeed = () => {
    form.reset();
    markDone();
  };
  const [resolver] = useState(() => zodResolver(doorCheckInSchema));
  const form = useForm<z.input<typeof doorCheckInSchema>, unknown, z.output<typeof doorCheckInSchema>>({ resolver, defaultValues: { phone: '' } });
  const admit = form.handleSubmit(async ({ phone }) => {
    setOutcome(null);
    const opened = await checkInByPhone.mutateAsync(phone);
    setOutcome(opened.ok ? 'checked_in' : { in: opened.error });
    if (opened.ok) succeed();
  }, () => setOutcome(null));
  const release = form.handleSubmit(async ({ phone }) => {
    setOutcome(null);
    const closed = await checkOutByPhone.mutateAsync(phone);
    setOutcome(closed.ok ? 'checked_out' : { out: closed.error });
    if (closed.ok) succeed();
  }, () => setOutcome(null));
  const phone = form.register('phone');
  const isFailure = outcome !== null && outcome !== 'checked_in' && outcome !== 'checked_out';
  const isRepeat = () => isJustDone && form.getValues('phone') === '';
  return (
    <Stack gap={2}>
      <Inline gap={3} align="end" wrap>
        <Input {...phone} type="tel" label={t('console.checkIn.phone')} prefix={t('common.signIn.countryCode')} inputMode="tel" autoComplete="off" />
        <Button variant="secondary" isLoading={checkInByPhone.isPending} onClick={() => { if (!isRepeat()) void admit(); }}>{t('console.checkIn.checkIn')}</Button>
        <Button variant="text" isLoading={checkOutByPhone.isPending} onClick={() => { if (!isRepeat()) void release(); }}>{t('console.checkIn.checkOut')}</Button>
      </Inline>
      {form.formState.errors.phone ? <ErrorMessage>{t('console.checkIn.invalid')}</ErrorMessage> : null}
      <StatusMessage>{outcome === 'checked_in' ? t('console.checkIn.checkedIn') : null}</StatusMessage>
      {outcome === 'checked_out' ? <Text variant="small">{t('console.checkIn.checkedOut')}</Text> : null}
      {isFailure ? <ErrorMessage>{'in' in outcome ? t(CHECK_IN_FAILURE_COPY[outcome.in]) : checkOutRefusalText(outcome.out)}</ErrorMessage> : null}
    </Stack>
  );
}
