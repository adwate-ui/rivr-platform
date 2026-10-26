import { zodResolver } from '@hookform/resolvers/zod';
import { expenseRequestSchema } from '@rivr/contracts';
import { useExpenseActions, type ExpenseCategory, type ExpenseFailure, type PaymentAccount } from '@rivr/db';
import { fromRupees } from '@rivr/domain/money';
import { t } from '@rivr/i18n';
import { Button, CameraButton, ChoiceChips, ErrorMessage, Heading, Input, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { useForm, useWatch, type UseFormReturn } from 'react-hook-form';
import type { z } from 'zod';
import { EXPENSE_FAILURE_COPY } from './expenseCopy.ts';

type RequestFields = UseFormReturn<z.input<typeof expenseRequestSchema>, unknown, z.output<typeof expenseRequestSchema>>;

interface RequestFormProps {
  venueId: string;
  categories: readonly ExpenseCategory[];
  accounts: readonly PaymentAccount[];
}

/** The category, the account it is paid from, the amount, the payee and a note. */
function RequestInputs({ form, categories, accounts }: { form: RequestFields } & Omit<RequestFormProps, 'venueId'>) {
  const categoryId = useWatch({ control: form.control, name: 'categoryId' });
  const accountId = useWatch({ control: form.control, name: 'accountId' });
  const errors = form.formState.errors;
  const fields = { amount: form.register('amount'), payee: form.register('payee'), note: form.register('note') };
  return (
    <Stack gap={4}>
      {categories.length === 0 ? <Text tone="muted">{t('console.expenses.noCategories')}</Text> : (
        <ChoiceChips label={t('console.expenses.category')} mode="one" selected={categoryId === '' ? [] : [categoryId]}
          options={categories.map((category) => ({ value: category.id, label: category.name }))} onChange={(picked) => form.setValue('categoryId', picked[0] ?? '')} />
      )}
      {errors.categoryId ? <ErrorMessage>{t('console.expenses.chooseCategory')}</ErrorMessage> : null}
      <ChoiceChips label={t('console.expenses.account')} mode="one" selected={accountId === '' ? [] : [accountId]}
        options={accounts.map((account) => ({ value: account.id, label: account.name }))} onChange={(picked) => form.setValue('accountId', picked[0] ?? '')} />
      <Input {...fields.amount} label={t('console.expenses.amount')} prefix={t('console.expenses.rupee')} inputMode="numeric" autoComplete="off"
        error={errors.amount ? t('console.expenses.invalidAmount') : undefined} />
      <Input {...fields.payee} label={t('console.expenses.payee')} autoComplete="off" error={errors.payee ? t('console.expenses.invalidPayee') : undefined} />
      <Input {...fields.note} label={t('console.expenses.note')} autoComplete="off" error={errors.note ? t('console.expenses.invalidNote') : undefined} />
    </Stack>
  );
}

/**
 * Asks for an expense (#95) with a photo of its receipt, sent to the private receipts bucket under the
 * expense's id; the id stays the same across a retry, so a retried tap asks once.
 */
export function RequestForm({ venueId, categories, accounts }: RequestFormProps) {
  const { request } = useExpenseActions(venueId);
  const [expenseId, setExpenseId] = useState(() => crypto.randomUUID());
  const [receipt, setReceipt] = useState<File | null>(null);
  const [outcome, setOutcome] = useState<{ isSent: boolean; failure: ExpenseFailure | null }>({ isSent: false, failure: null });
  const [resolver] = useState(() => zodResolver(expenseRequestSchema));
  const form: RequestFields = useForm({ resolver, defaultValues: { categoryId: '', accountId: '', amount: '', payee: '', note: '' } });
  const submit = form.handleSubmit(async ({ amount, ...rest }) => {
    const done = await request.mutateAsync({ ...rest, expenseId, amount: fromRupees(BigInt(amount)), receipt });
    setOutcome({ isSent: done.ok, failure: done.ok ? null : done.error });
    if (!done.ok) return;
    form.reset();
    setReceipt(null);
    setExpenseId(crypto.randomUUID());
  });
  return (
    <Stack gap={3}>
      <Heading level={2}>{t('console.expenses.request')}</Heading>
      <RequestInputs form={form} categories={categories} accounts={accounts} />
      <CameraButton camera="environment" onPhoto={setReceipt}>{receipt === null ? t('console.expenses.receipt') : t('console.expenses.receiptAgain')}</CameraButton>
      {receipt === null ? null : <Text variant="small" tone="muted">{t('console.expenses.receiptReady')}</Text>}
      <Button variant="primary" isLoading={request.isPending} onClick={() => void submit()}>{t('console.expenses.requestSave')}</Button>
      {outcome.failure === null ? null : <ErrorMessage>{t(EXPENSE_FAILURE_COPY[outcome.failure])}</ErrorMessage>}
      {outcome.isSent ? <Text tone="money">{t('console.expenses.requested')}</Text> : null}
    </Stack>
  );
}
