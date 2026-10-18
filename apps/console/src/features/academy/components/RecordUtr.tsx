import { zodResolver } from '@hookform/resolvers/zod';
import { utrSchema } from '@rivr/contracts';
import { useStaffAcademyActions } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, Inline, Input } from '@rivr/ui';
import { useState } from 'react';
import { useForm, type FieldError } from 'react-hook-form';
import { z } from 'zod';
import { FAILURE_COPY } from './failureCopy.ts';

const utrForm = z.object({ utr: utrSchema });

/** A refusal carries its own words; anything else failed the field's check. */
function utrErrorOf(error: FieldError | undefined): string | undefined {
  if (!error) return undefined;
  return error.type === 'server' ? error.message : t('console.academy.utrInvalid');
}

/**
 * The UTR of a payment the payer could not give in the app, such as a company's, recorded by
 * Academy staff. Another staff member at the cage confirms it against the bank.
 */
export function RecordUtr({ venueId, bookingId, payer }: { venueId: string; bookingId: string; payer: string }) {
  const { recordPayment } = useStaffAcademyActions(venueId);
  const [resolver] = useState(() => zodResolver(utrForm));
  const form = useForm<z.input<typeof utrForm>, unknown, z.output<typeof utrForm>>({ resolver, defaultValues: { utr: '' } });
  const record = form.handleSubmit(async ({ utr }) => {
    const recorded = await recordPayment.mutateAsync({ bookingId, utr });
    if (!recorded.ok) form.setError('utr', { type: 'server', message: t(FAILURE_COPY[recorded.error]) });
  });
  const utrField = form.register('utr');
  return (
    <Inline gap={3} align="end">
      <Input {...utrField} label={t('console.academy.utrFor', { name: payer })} inputMode="numeric" maxLength={12} autoComplete="off"
        error={utrErrorOf(form.formState.errors.utr)} />
      <Button variant="secondary" isLoading={recordPayment.isPending} onClick={() => void record()}>
        {t('console.academy.recordUtr')}
      </Button>
    </Inline>
  );
}
