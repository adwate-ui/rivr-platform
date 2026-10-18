import { zodResolver } from '@hookform/resolvers/zod';
import { academyBatchSchema } from '@rivr/contracts';
import { useStaffAcademyActions, type AcademyStaffFailure } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, Heading, Inline, Input, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { FAILURE_COPY } from './failureCopy.ts';

/** Opens a batch: its name, first and last days, and seats. Members book it from the player app. */
export function NewBatchForm({ venueId }: { venueId: string }) {
  const { openBatch } = useStaffAcademyActions(venueId);
  const [failure, setFailure] = useState<AcademyStaffFailure | null>(null);
  const [resolver] = useState(() => zodResolver(academyBatchSchema));
  const form = useForm<z.input<typeof academyBatchSchema>, unknown, z.output<typeof academyBatchSchema>>({
    resolver, defaultValues: { name: '', startsOn: '', endsOn: '', seats: '' },
  });
  const open = form.handleSubmit(async (batch) => {
    const opened = await openBatch.mutateAsync(batch);
    setFailure(opened.ok ? null : opened.error);
    if (opened.ok) form.reset();
  });
  const isInvalid = Object.keys(form.formState.errors).length > 0;
  const name = form.register('name');
  const startsOn = form.register('startsOn');
  const endsOn = form.register('endsOn');
  const seats = form.register('seats');
  return (
    <Stack gap={4}>
      <Heading level={2}>{t('console.academy.newBatch')}</Heading>
      <Inline gap={4} align="end" wrap>
        <Input {...name} label={t('console.academy.batchName')} autoComplete="off" />
        <Input {...startsOn} type="date" label={t('console.academy.startsOn')} />
        <Input {...endsOn} type="date" label={t('console.academy.endsOn')} />
        <Input {...seats} label={t('console.academy.seats')} inputMode="numeric" autoComplete="off" />
        <Button variant="primary" isLoading={openBatch.isPending} onClick={() => void open()}>
          {t('console.academy.openBatch')}
        </Button>
      </Inline>
      {isInvalid ? <Text>{t('console.academy.batchInvalid')}</Text> : null}
      {failure === null ? null : <Text>{t(FAILURE_COPY[failure])}</Text>}
    </Stack>
  );
}
