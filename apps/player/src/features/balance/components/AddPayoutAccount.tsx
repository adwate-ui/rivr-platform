import { zodResolver } from '@hookform/resolvers/zod';
import { payoutAccountSchema, type PayoutKind } from '@rivr/contracts';
import { usePayoutAccountActions } from '@rivr/db';
import { t, type MessageKey } from '@rivr/i18n';
import { Button, ChoiceChips, ErrorMessage, Inline, Input, Stack } from '@rivr/ui';
import { useState } from 'react';
import { Controller, useForm, useWatch, type FieldError, type UseFormReturn } from 'react-hook-form';
import type { z } from 'zod';
import { PAYOUT_FAILURE_COPY } from './payoutCopy.ts';

type Form = z.input<typeof payoutAccountSchema>;

const KINDS: readonly { value: PayoutKind; label: MessageKey }[] = [
  { value: 'upi', label: 'player.balance.payoutKindUpi' },
  { value: 'bank', label: 'player.balance.payoutKindBank' },
];

const BLANK: Form = { kind: 'upi', bankName: '', vpa: '', accountNumber: '', ifsc: '', holderName: '' };

const errorOf = (error: FieldError | undefined, key: MessageKey) => (error ? t(key) : undefined);

/** The bank account's own fields: number, IFSC and the name on it. */
function BankFields({ form }: { form: UseFormReturn<Form, unknown, z.output<typeof payoutAccountSchema>> }) {
  const errors = form.formState.errors;
  const number = form.register('accountNumber');
  const ifsc = form.register('ifsc');
  const holder = form.register('holderName');
  return (
    <>
      <Input {...number} label={t('player.balance.accountNumber')} inputMode="numeric" maxLength={18} autoComplete="off"
        error={errorOf(errors.accountNumber, 'player.balance.accountNumberInvalid')} />
      <Input {...ifsc} label={t('player.balance.ifsc')} maxLength={11} autoComplete="off" error={errorOf(errors.ifsc, 'player.balance.ifscInvalid')} />
      <Input {...holder} label={t('player.balance.holderName')} autoComplete="name" error={errorOf(errors.holderName, 'player.balance.holderNameInvalid')} />
    </>
  );
}

/**
 * Adding a payout account on Balance (#19): a UPI address, or a bank account by number, IFSC and the
 * name on it, with the bank's name. It waits for the cage to verify it before a withdrawal can use it.
 */
export function AddPayoutAccount({ onDone }: { onDone: (added: boolean) => void }) {
  const { add } = usePayoutAccountActions();
  const [resolver] = useState(() => zodResolver(payoutAccountSchema));
  const form = useForm<Form, unknown, z.output<typeof payoutAccountSchema>>({ resolver, defaultValues: BLANK });
  const kind = useWatch({ control: form.control, name: 'kind' });
  const errors = form.formState.errors;
  const save = form.handleSubmit(async (account) => {
    const added = await add.mutateAsync(account);
    if (added.ok) onDone(true);
  });
  const bankName = form.register('bankName');
  const vpa = form.register('vpa');
  return (
    <Stack gap={3}>
      <Controller control={form.control} name="kind" render={({ field }) => (
        <ChoiceChips label={t('player.balance.payoutKind')} mode="one" selected={[field.value]}
          options={KINDS.map((option) => ({ value: option.value, label: t(option.label) }))}
          onChange={([value]) => field.onChange(value ?? field.value)} />
      )} />
      <Input {...bankName} label={t('player.balance.bankName')} autoComplete="off" error={errorOf(errors.bankName, 'player.balance.bankNameInvalid')} />
      {kind === 'upi' ? (
        <Input {...vpa} label={t('player.balance.vpa')} autoComplete="off" error={errorOf(errors.vpa, 'player.balance.vpaInvalid')} />
      ) : <BankFields form={form} />}
      {add.data?.ok === false ? <ErrorMessage>{t(PAYOUT_FAILURE_COPY[add.data.error])}</ErrorMessage> : null}
      <Inline gap={3}>
        <Button variant="primary" isLoading={add.isPending} onClick={() => void save()}>{t('player.balance.savePayout')}</Button>
        <Button variant="text" onClick={() => onDone(false)}>{t('player.balance.cancel')}</Button>
      </Inline>
    </Stack>
  );
}
