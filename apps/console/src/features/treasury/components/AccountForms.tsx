import { zodResolver } from '@hookform/resolvers/zod';
import { paymentAccountSchema, transferSchema } from '@rivr/contracts/treasury';
import { usePaymentAccountActions, type AccountFailure, type PaymentAccount } from '@rivr/db';
import { fromRupees } from '@rivr/domain/money';
import { formatMoney, t } from '@rivr/i18n';
import { Button, ChoiceChips, ErrorMessage, Heading, Input, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { useForm, useWatch, type UseFormReturn } from 'react-hook-form';
import type { z } from 'zod';
import { ACCOUNT_FAILURE_COPY } from './accountCopy.ts';

type TransferFields = UseFormReturn<z.input<typeof transferSchema>, unknown, z.output<typeof transferSchema>>;

/** What happened last: a line to show, or why it failed. */
interface Outcome {
  readonly done: string | null;
  readonly failure: AccountFailure | null;
}

function OutcomeLine({ outcome }: { outcome: Outcome }) {
  if (outcome.failure !== null) return <ErrorMessage>{t(ACCOUNT_FAILURE_COPY[outcome.failure])}</ErrorMessage>;
  return outcome.done === null ? null : <Text tone="money">{outcome.done}</Text>;
}

/** The two accounts, the amount and a note. Any change is a new transfer, with a new request id. */
function TransferInputs({ form, accounts, onChange }: { form: TransferFields; accounts: readonly PaymentAccount[]; onChange: () => void }) {
  const fromId = useWatch({ control: form.control, name: 'fromId' });
  const toId = useWatch({ control: form.control, name: 'toId' });
  const errors = form.formState.errors;
  const fields = { amount: form.register('amount', { onChange }), note: form.register('note') };
  const options = accounts.map((account) => ({ value: account.id, label: account.name }));
  return (
    <Stack gap={4}>
      <ChoiceChips label={t('console.accounts.from')} mode="one" options={options} selected={fromId === '' ? [] : [fromId]}
        onChange={(picked) => { form.setValue('fromId', picked[0] ?? ''); onChange(); }} />
      <ChoiceChips label={t('console.accounts.to')} mode="one" options={options} selected={toId === '' ? [] : [toId]}
        onChange={(picked) => { form.setValue('toId', picked[0] ?? ''); onChange(); }} />
      {errors.fromId || errors.toId ? <ErrorMessage>{t(errors.toId?.type === 'custom' ? 'console.accounts.invalidTo' : 'console.accounts.chooseAccounts')}</ErrorMessage> : null}
      <Input {...fields.amount} label={t('console.accounts.amount')} prefix={t('console.accounts.rupee')} inputMode="numeric" autoComplete="off"
        error={errors.amount ? t('console.accounts.invalidAmount') : undefined} />
      <Input {...fields.note} label={t('console.accounts.note')} autoComplete="off" />
    </Stack>
  );
}

/** A treasury manager moves money from one account to another (#94): one balanced transaction, once per tap. */
export function TransferForm({ venueId, accounts }: { venueId: string; accounts: readonly PaymentAccount[] }) {
  const { transfer } = usePaymentAccountActions(venueId);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [outcome, setOutcome] = useState<Outcome>({ done: null, failure: null });
  const [resolver] = useState(() => zodResolver(transferSchema));
  const form: TransferFields = useForm({ resolver, defaultValues: { fromId: '', toId: '', amount: '', note: '' } });
  const nameOf = (id: string) => accounts.find((account) => account.id === id)?.name ?? '';
  const submit = form.handleSubmit(async ({ fromId, toId, amount, note }) => {
    const paise = fromRupees(BigInt(amount));
    const done = await transfer.mutateAsync({ fromId, toId, amount: paise, note, requestId });
    if (!done.ok) return setOutcome({ done: null, failure: done.error });
    setOutcome({ done: t('console.accounts.moved', { amount: formatMoney(paise), from: nameOf(fromId), to: nameOf(toId) }), failure: null });
    form.reset();
    setRequestId(crypto.randomUUID());
  });
  return (
    <Stack gap={3}>
      <Heading level={2}>{t('console.accounts.transfer')}</Heading>
      <TransferInputs form={form} accounts={accounts} onChange={() => setRequestId(crypto.randomUUID())} />
      <Button variant="primary" isLoading={transfer.isPending} onClick={() => void submit()}>{t('console.accounts.transferSave')}</Button>
      <OutcomeLine outcome={outcome} />
    </Stack>
  );
}

/** A treasury manager adds a UPI handle or a bank account (#94); the drawer and the bank every venue has. */
export function AddAccountForm({ venueId }: { venueId: string }) {
  const { add } = usePaymentAccountActions(venueId);
  const [outcome, setOutcome] = useState<Outcome>({ done: null, failure: null });
  const [resolver] = useState(() => zodResolver(paymentAccountSchema));
  const form = useForm<z.input<typeof paymentAccountSchema>, unknown, z.output<typeof paymentAccountSchema>>({
    resolver, defaultValues: { kind: 'upi', name: '', details: '' },
  });
  const submit = form.handleSubmit(async (account) => {
    const done = await add.mutateAsync(account);
    setOutcome(done.ok ? { done: t('console.accounts.added'), failure: null } : { done: null, failure: done.error });
    if (done.ok) form.reset();
  });
  const errors = form.formState.errors;
  const kind = useWatch({ control: form.control, name: 'kind' });
  const fields = { name: form.register('name'), details: form.register('details') };
  return (
    <Stack gap={3}>
      <Heading level={2}>{t('console.accounts.add')}</Heading>
      <ChoiceChips label={t('console.accounts.kind')} mode="one" selected={[kind]}
        options={[{ value: 'upi', label: t('console.accounts.kinds.upi') }, { value: 'bank', label: t('console.accounts.kinds.bank') }]}
        onChange={(picked) => form.setValue('kind', picked[0] === 'bank' ? 'bank' : 'upi')} />
      <Input {...fields.name} label={t('console.accounts.name')} autoComplete="off" error={errors.name ? t('console.accounts.invalidName') : undefined} />
      <Input {...fields.details} label={t('console.accounts.detailsField')} autoComplete="off"
        error={errors.details ? t('console.accounts.invalidDetails') : undefined} />
      <Button isLoading={add.isPending} onClick={() => void submit()}>{t('console.accounts.addSave')}</Button>
      <OutcomeLine outcome={outcome} />
    </Stack>
  );
}
