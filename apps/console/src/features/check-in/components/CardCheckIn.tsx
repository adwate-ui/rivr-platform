import { zodResolver } from '@hookform/resolvers/zod';
import { doorCardSchema } from '@rivr/contracts';
import { useCheckInActions, type CheckInFailure } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, ErrorMessage, Inline, Input, Stack } from '@rivr/ui';
import { useState, type KeyboardEvent } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { CHECK_IN_FAILURE_COPY } from './checkInCopy.ts';

/**
 * Checks a member in by their membership card (#71): the door's scanner reads the card's QR and types its
 * code into the field, then Enter, as a keyboard does. The field has the focus, and is emptied and given
 * it back after every scan, so the next scan never lands after a refused one. A code from before the
 * card's QR changed is refused.
 */
export function CardCheckIn({ venueId }: { venueId: string }) {
  const { checkInByCard } = useCheckInActions(venueId);
  const [failure, setFailure] = useState<CheckInFailure | null>(null);
  const [resolver] = useState(() => zodResolver(doorCardSchema));
  const form = useForm<z.input<typeof doorCardSchema>, unknown, z.output<typeof doorCardSchema>>({ resolver, defaultValues: { code: '' } });
  const submit = form.handleSubmit(async ({ code }) => {
    const opened = await checkInByCard.mutateAsync(code);
    setFailure(opened.ok ? null : opened.error);
    form.reset();
    form.setFocus('code');
  });
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') void submit();
  };
  const code = form.register('code');
  return (
    <Stack gap={2}>
      <Inline gap={3} align="end" wrap>
        <Input {...code} label={t('console.checkIn.card')} autoComplete="off" autoFocus onKeyDown={onKeyDown} />
        <Button variant="secondary" isLoading={checkInByCard.isPending} onClick={() => void submit()}>{t('console.checkIn.checkInByCard')}</Button>
      </Inline>
      {form.formState.errors.code ? <ErrorMessage>{t('console.checkIn.cardInvalid')}</ErrorMessage> : null}
      {failure === null ? null : <ErrorMessage>{t(CHECK_IN_FAILURE_COPY[failure])}</ErrorMessage>}
    </Stack>
  );
}
