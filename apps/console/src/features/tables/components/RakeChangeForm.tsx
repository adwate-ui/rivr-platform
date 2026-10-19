import { zodResolver } from '@hookform/resolvers/zod';
import { rakeChangeSchema } from '@rivr/contracts';
import { useRakeChangeActions, type RakeChangeFailure, type TableTypeRake } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, ChoiceChips, ErrorMessage, Heading, Inline, Input, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import type { z } from 'zod';
import { rakeFailureText } from './rakeCopy.ts';

type RakeChangeValues = z.input<typeof rakeChangeSchema>;

const EMPTY: RakeChangeValues = { tableTypeCode: '', ratePercent: '', cap: '', on: '', at: '', reason: '' };

/**
 * Schedules a rake change for one table type: its new rate and cap from a date and an IST time, and
 * why. The change takes effect at that time; hands played before it keep the rule they were played under.
 */
export function RakeChangeForm({ venueId, tableTypes }: { venueId: string; tableTypes: readonly TableTypeRake[] }) {
  const { schedule } = useRakeChangeActions(venueId);
  const [failure, setFailure] = useState<RakeChangeFailure | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [resolver] = useState(() => zodResolver(rakeChangeSchema));
  const form = useForm<RakeChangeValues, unknown, z.output<typeof rakeChangeSchema>>({ resolver, defaultValues: EMPTY });
  const submit = form.handleSubmit(async (change) => {
    const scheduled = await schedule.mutateAsync(change);
    setFailure(scheduled.ok ? null : scheduled.error);
    setIsSaved(scheduled.ok);
    if (scheduled.ok) form.reset(EMPTY);
  });
  const errors = form.formState.errors;
  const fields = { rate: form.register('ratePercent'), cap: form.register('cap'), on: form.register('on'), at: form.register('at'), reason: form.register('reason') };
  return (
    <Stack gap={4}>
      <Stack gap={1}>
        <Heading level={2}>{t('console.rake.change')}</Heading>
        <Text variant="small" tone="muted">{t('console.rake.changeHint')}</Text>
      </Stack>
      <Controller control={form.control} name="tableTypeCode" render={({ field }) => (
        <ChoiceChips label={t('console.rake.tableType')} mode="one" selected={field.value === '' ? [] : [field.value]}
          options={tableTypes.map((type) => ({ value: type.code, label: type.name }))} onChange={(chosen) => field.onChange(chosen[0] ?? '')} />
      )} />
      {errors.tableTypeCode ? <ErrorMessage>{t('console.rake.chooseTableType')}</ErrorMessage> : null}
      <Inline gap={4} align="start" wrap>
        <Input {...fields.rate} label={t('console.rake.rate')} hint={t('console.rake.rateHint')} inputMode="decimal" error={errors.ratePercent ? t('console.rake.invalidRate') : undefined} />
        <Input {...fields.cap} label={t('console.rake.cap')} hint={t('console.rake.capHint')} inputMode="numeric" error={errors.cap ? t('console.rake.invalidCap') : undefined} />
        <Input {...fields.on} type="date" label={t('console.rake.on')} error={errors.on ? t('console.rake.invalidWhen') : undefined} />
        <Input {...fields.at} label={t('console.rake.at')} hint={t('console.rake.atHint')} inputMode="numeric" error={errors.at ? t('console.rake.invalidWhen') : undefined} />
      </Inline>
      <Input {...fields.reason} label={t('console.rake.reason')} error={errors.reason ? t('console.rake.invalidReason') : undefined} />
      <Inline gap={4}>
        <Button variant="primary" isLoading={schedule.isPending} onClick={() => void submit()}>{t('console.rake.save')}</Button>
        {isSaved ? <Text variant="small">{t('console.rake.saved')}</Text> : null}
      </Inline>
      {failure === null ? null : <ErrorMessage>{rakeFailureText(failure)}</ErrorMessage>}
    </Stack>
  );
}
