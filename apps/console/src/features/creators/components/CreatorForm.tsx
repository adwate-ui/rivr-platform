import { zodResolver } from '@hookform/resolvers/zod';
import { COMMISSION_BASES, newCreatorSchema } from '@rivr/contracts/creators';
import { useAddCreator } from '@rivr/db/creators';
import { fromRupees } from '@rivr/domain/money';
import { t } from '@rivr/i18n';
import { Button, ChoiceChips, ErrorMessage, Heading, Input, Stack, StatusMessage } from '@rivr/ui';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import type { z } from 'zod';

type CreatorValues = z.input<typeof newCreatorSchema>;
const EMPTY: CreatorValues = { name: '', code: '', basis: 'first_buy_in', commission: '' };

/** A new creator (#163): their name, the code their links carry, and their commission in whole rupees on each member who reaches the stage chosen. */
export function CreatorForm({ venueId }: { venueId: string }) {
  const add = useAddCreator(venueId);
  const [resolver] = useState(() => zodResolver(newCreatorSchema));
  const form = useForm<CreatorValues, unknown, z.output<typeof newCreatorSchema>>({ resolver, defaultValues: EMPTY });
  const [outcome, setOutcome] = useState<{ ok: boolean; text: string } | null>(null);
  const submit = form.handleSubmit(async (values) => {
    const done = await add.mutateAsync({ name: values.name, code: values.code, basis: values.basis, commission: fromRupees(BigInt(values.commission)) });
    setOutcome(done.ok ? { ok: true, text: t('console.creators.added', { name: values.name, code: values.code }) }
      : { ok: false, text: t(`console.creators.failures.${done.error}`) });
    if (done.ok) form.reset(EMPTY);
  });
  const fields = { name: form.register('name'), code: form.register('code'), commission: form.register('commission') };
  const isInvalid = Object.keys(form.formState.errors).length > 0;
  return (
    <Stack gap={4}>
      <Heading level={2} variant="section">{t('console.creators.addTitle')}</Heading>
      <Input {...fields.name} label={t('console.creators.name')} autoComplete="off" />
      <Input {...fields.code} label={t('console.creators.code')} hint={t('console.creators.codeHint')} autoComplete="off" />
      <Controller control={form.control} name="basis" render={({ field }) => (
        <ChoiceChips label={t('console.creators.basis')} mode="one" selected={[field.value]}
          options={COMMISSION_BASES.map((basis) => ({ value: basis, label: t(`console.creators.basisNames.${basis}`) }))}
          onChange={(chosen) => { if (chosen[0] !== undefined) field.onChange(chosen[0]); }} />
      )} />
      <Input {...fields.commission} label={t('console.creators.commissionLabel')} hint={t('console.creators.commissionHint')}
        inputMode="numeric" autoComplete="off" />
      {isInvalid ? <ErrorMessage>{t('console.creators.invalid')}</ErrorMessage> : null}
      <Button variant="secondary" isLoading={add.isPending} onClick={() => void submit()}>{t('console.creators.add')}</Button>
      <StatusMessage>{outcome?.ok === true ? outcome.text : null}</StatusMessage>
      {outcome?.ok === false ? <ErrorMessage>{outcome.text}</ErrorMessage> : null}
    </Stack>
  );
}
