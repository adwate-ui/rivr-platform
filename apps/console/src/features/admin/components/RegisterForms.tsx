import { zodResolver } from '@hookform/resolvers/zod';
import { holdingSchema, shareholderSchema } from '@rivr/contracts/shareholding';
import { useShareholdingActions, useShareholdingRegister, type RegisterFailure } from '@rivr/db/shareholding';
import { t } from '@rivr/i18n';
import { Button, ChoiceChips, ErrorMessage, Heading, Input, Stack, Text, StatusMessage } from '@rivr/ui';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import type { z } from 'zod';

const IST_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' });

/** What happened last: done, or why not. */
function Outcome({ outcome, doneText }: { outcome: RegisterFailure | 'done' | null; doneText: string }) {
  return (
    <>
      <StatusMessage>{outcome === 'done' ? doneText : null}</StatusMessage>
      {outcome === null || outcome === 'done' ? null : <ErrorMessage>{t(`console.shareholders.failures.${outcome}`)}</ErrorMessage>}
    </>
  );
}

/** A super admin adds a partner or an investor (#97). */
export function AddHolderForm({ venueId }: { venueId: string }) {
  const { addHolder } = useShareholdingActions(venueId);
  const [outcome, setOutcome] = useState<RegisterFailure | 'done' | null>(null);
  const [resolver] = useState(() => zodResolver(shareholderSchema));
  const form = useForm<z.input<typeof shareholderSchema>, unknown, z.output<typeof shareholderSchema>>({ resolver, defaultValues: { name: '', kind: 'partner' } });
  const kind = useWatch({ control: form.control, name: 'kind' });
  const nameField = form.register('name');
  const submit = form.handleSubmit(async (holder) => {
    const done = await addHolder.mutateAsync(holder);
    setOutcome(done.ok ? 'done' : done.error);
    if (done.ok) form.reset();
  });
  return (
    <Stack gap={3}>
      <Heading level={2}>{t('console.shareholders.addHolder')}</Heading>
      <Input {...nameField} label={t('console.shareholders.name')} autoComplete="off"
        error={form.formState.errors.name ? t('console.shareholders.invalidName') : undefined} />
      <ChoiceChips label={t('console.shareholders.kind')} mode="one" selected={[kind]}
        options={[{ value: 'partner', label: t('console.shareholders.kinds.partner') }, { value: 'investor', label: t('console.shareholders.kinds.investor') }]}
        onChange={(picked) => form.setValue('kind', picked[0] === 'investor' ? 'investor' : 'partner')} />
      <Button isLoading={addHolder.isPending} onClick={() => void submit()}>{t('console.shareholders.addSave')}</Button>
      <Outcome outcome={outcome} doneText={t('console.shareholders.added')} />
    </Stack>
  );
}

/**
 * A super admin records what a holder holds from a day on (#97); the database refuses holdings that
 * would come to more than 100% on that day or a later one.
 */
export function RecordHoldingForm({ venueId }: { venueId: string }) {
  const today = IST_DAY.format(new Date());
  const holders = useShareholdingRegister(venueId, today);
  const { recordHolding } = useShareholdingActions(venueId);
  const [outcome, setOutcome] = useState<RegisterFailure | 'done' | null>(null);
  const [resolver] = useState(() => zodResolver(holdingSchema));
  const form = useForm<z.input<typeof holdingSchema>, unknown, z.output<typeof holdingSchema>>({
    resolver, defaultValues: { shareholderId: '', percent: '', effectiveFrom: today, note: '' },
  });
  const holder = useWatch({ control: form.control, name: 'shareholderId' });
  const errors = form.formState.errors;
  const fields = { percent: form.register('percent'), effectiveFrom: form.register('effectiveFrom'), note: form.register('note') };
  const submit = form.handleSubmit(async (holding) => {
    const done = await recordHolding.mutateAsync(holding);
    setOutcome(done.ok ? 'done' : done.error);
    if (done.ok) form.reset({ shareholderId: '', percent: '', effectiveFrom: today, note: '' });
  });
  return (
    <Stack gap={3}>
      <Heading level={2}>{t('console.shareholders.record')}</Heading>
      <Text variant="small" tone="muted">{t('console.shareholders.recordHint')}</Text>
      <ChoiceChips label={t('console.shareholders.holder')} mode="one" selected={holder === '' ? [] : [holder]}
        options={(holders.data ?? []).map((row) => ({ value: row.shareholderId, label: row.name }))} onChange={(picked) => form.setValue('shareholderId', picked[0] ?? '')} />
      {errors.shareholderId ? <ErrorMessage>{t('console.shareholders.chooseHolder')}</ErrorMessage> : null}
      <Input {...fields.percent} label={t('console.shareholders.percent')} inputMode="decimal" autoComplete="off"
        error={errors.percent ? t('console.shareholders.invalidPercent') : undefined} />
      <Input {...fields.effectiveFrom} type="date" label={t('console.shareholders.effectiveFrom')} error={errors.effectiveFrom ? t('console.shareholders.invalidDay') : undefined} />
      <Input {...fields.note} label={t('console.shareholders.note')} autoComplete="off" />
      <Button variant="primary" isLoading={recordHolding.isPending} onClick={() => void submit()}>{t('console.shareholders.recordSave')}</Button>
      <Outcome outcome={outcome} doneText={t('console.shareholders.recorded')} />
    </Stack>
  );
}
