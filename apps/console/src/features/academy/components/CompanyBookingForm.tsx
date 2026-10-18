import { zodResolver } from '@hookform/resolvers/zod';
import { companyBookingSchema } from '@rivr/contracts';
import { useStaffAcademyActions, type AcademyStaffFailure } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, Inline, Input, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { FAILURE_COPY } from './failureCopy.ts';

/**
 * Books a company's heads on a batch at the corporate fee per head, under a member of the venue as
 * the contact. One request id per form, so a retried tap books once.
 */
export function CompanyBookingForm({ venueId, batchId, onDone }: { venueId: string; batchId: string; onDone: () => void }) {
  const { bookCompany } = useStaffAcademyActions(venueId);
  const [requestId] = useState(() => crypto.randomUUID());
  const [failure, setFailure] = useState<AcademyStaffFailure | null>(null);
  const [resolver] = useState(() => zodResolver(companyBookingSchema));
  const form = useForm<z.input<typeof companyBookingSchema>, unknown, z.output<typeof companyBookingSchema>>({
    resolver, defaultValues: { contactPhone: '', companyName: '', seats: '' },
  });
  const book = form.handleSubmit(async (booking) => {
    const booked = await bookCompany.mutateAsync({ ...booking, batchId, requestId });
    if (booked.ok) onDone();
    else setFailure(booked.error);
  });
  const isInvalid = Object.keys(form.formState.errors).length > 0;
  const contactPhone = form.register('contactPhone');
  const companyName = form.register('companyName');
  const seats = form.register('seats');
  return (
    <Stack gap={3}>
      <Inline gap={4} align="end" wrap>
        <Input {...contactPhone} type="tel" label={t('console.academy.contactPhone')} prefix={t('common.signIn.countryCode')} inputMode="tel" autoComplete="off" />
        <Input {...companyName} label={t('console.academy.companyName')} autoComplete="off" />
        <Input {...seats} label={t('console.academy.heads')} inputMode="numeric" autoComplete="off" />
        <Button variant="primary" isLoading={bookCompany.isPending} onClick={() => void book()}>
          {t('console.academy.book')}
        </Button>
        <Button variant="text" onClick={onDone}>
          {t('common.cancel')}
        </Button>
      </Inline>
      {isInvalid ? <Text>{t('console.academy.companyInvalid')}</Text> : null}
      {failure === null ? null : <Text>{t(FAILURE_COPY[failure])}</Text>}
    </Stack>
  );
}
