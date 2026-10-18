import { zodResolver } from '@hookform/resolvers/zod';
import { utrSchema } from '@rivr/contracts';
import { useAcademyActions } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, Input, Stack } from '@rivr/ui';
import { useState } from 'react';
import { useForm, type FieldError } from 'react-hook-form';
import { z } from 'zod';
import { FAILURE_COPY } from './failureCopy.ts';

const utrForm = z.object({ utr: utrSchema });

/** A refusal carries its own words; anything else failed the field's check. */
function utrErrorOf(error: FieldError | undefined): string | undefined {
  if (!error) return undefined;
  return error.type === 'server' ? error.message : t('player.academy.utrInvalid');
}

/** The 12-digit UTR of the member's UPI payment, given or corrected until a cashier confirms it. */
export function UtrForm({ bookingId }: { bookingId: string }) {
  const { claimPayment } = useAcademyActions();
  const [resolver] = useState(() => zodResolver(utrForm));
  const form = useForm<z.input<typeof utrForm>, unknown, z.output<typeof utrForm>>({ resolver, defaultValues: { utr: '' } });
  const send = form.handleSubmit(async ({ utr }) => {
    const sent = await claimPayment.mutateAsync({ bookingId, utr });
    if (sent.ok) form.reset();
    else form.setError('utr', { type: 'server', message: t(FAILURE_COPY[sent.error]) });
  });
  const utrField = form.register('utr');
  return (
    <Stack gap={3}>
      <Input {...utrField} label={t('player.academy.utrLabel')} inputMode="numeric" maxLength={12} autoComplete="off"
        error={utrErrorOf(form.formState.errors.utr)} />
      <Button variant="primary" fullWidth isLoading={claimPayment.isPending} onClick={() => void send()}>
        {t('player.academy.sendUtr')}
      </Button>
    </Stack>
  );
}
