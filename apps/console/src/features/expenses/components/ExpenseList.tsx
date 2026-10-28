import { zodResolver } from '@hookform/resolvers/zod';
import { expenseRejectionSchema } from '@rivr/contracts/treasury';
import { useExpenseActions, useReceiptUrl, useVenueExpenses, type ExpenseFailure, type VenueExpense } from '@rivr/db';
import { formatDate, formatMoney, t } from '@rivr/i18n';
import { Button, ErrorMessage, Heading, Inline, Input, KycPhoto, kycPhotoStatus, Money, Stack, Text, LoadState } from '@rivr/ui';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { EXPENSE_FAILURE_COPY, statusLine } from './expenseCopy.ts';

/** The receipt's photo, fetched only once asked for. */
function Receipt({ expense }: { expense: VenueExpense }) {
  const [isShown, setIsShown] = useState(false);
  const url = useReceiptUrl(isShown ? expense.receiptPath : null);
  const name = t('console.expenses.viewReceiptOf', { payee: expense.payee });
  if (expense.receiptPath === null) return null;
  if (!isShown) return <Button aria-label={name} onClick={() => setIsShown(true)}>{t('console.expenses.viewReceipt')}</Button>;
  return <KycPhoto alt={name} src={url.data ?? null} status={kycPhotoStatus(expense.receiptPath, url)} />;
}

/** Approve, or turn down with a reason; the one who asked sees that a second person decides. */
function Decision({ venueId, expense }: { venueId: string; expense: VenueExpense }) {
  const { decide } = useExpenseActions(venueId);
  const [isRejecting, setIsRejecting] = useState(false);
  const [failure, setFailure] = useState<ExpenseFailure | null>(null);
  const [resolver] = useState(() => zodResolver(expenseRejectionSchema));
  const form = useForm<z.input<typeof expenseRejectionSchema>, unknown, z.output<typeof expenseRejectionSchema>>({ resolver, defaultValues: { reason: '' } });
  const send = async (isApproved: boolean, note: string) => {
    const done = await decide.mutateAsync({ expenseId: expense.id, isApproved, note });
    setFailure(done.ok ? null : done.error);
  };
  const reject = form.handleSubmit(({ reason }) => send(false, reason));
  const reasonField = form.register('reason');
  if (expense.isMine) return <Text variant="small" tone="muted">{t('console.expenses.yours')}</Text>;
  const names = { amount: formatMoney(expense.amount), payee: expense.payee };
  return (
    <Stack gap={2}>
      {isRejecting ? <Input {...reasonField} label={t('console.expenses.reason')} error={form.formState.errors.reason ? t('console.expenses.invalidReason') : undefined} /> : null}
      <Inline gap={2}>
        {isRejecting ? null : <Button aria-label={t('console.expenses.approveName', names)} isLoading={decide.isPending}
          onClick={() => void send(true, '')}>{t('console.expenses.approve')}</Button>}
        <Button aria-label={t('console.expenses.rejectName', names)} isLoading={decide.isPending}
          onClick={() => (isRejecting ? void reject() : setIsRejecting(true))}>{t('console.expenses.reject')}</Button>
      </Inline>
      {failure === null ? null : <ErrorMessage>{t(EXPENSE_FAILURE_COPY[failure])}</ErrorMessage>}
    </Stack>
  );
}

/** One expense: to whom and what for, from which account and when, its status with who, the amount, and what can be done. */
function ExpenseRow({ venueId, expense, canDecide }: { venueId: string; expense: VenueExpense; canDecide: boolean }) {
  return (
    <Stack gap={3}>
      <Inline gap={4} justify="between" align="start">
        <Stack gap={1}>
          <Text weight="medium">{expense.payee}</Text>
          <Text variant="small" tone="muted">{`${expense.category} · ${expense.account} · ${formatDate(new Date(expense.requestedAt))}`}</Text>
          <Text variant="small">{statusLine(expense)}</Text>
          {expense.note === null ? null : <Text variant="small" tone="muted">{expense.note}</Text>}
          {expense.decisionNote === null ? null : <Text variant="small" tone="muted">{expense.decisionNote}</Text>}
        </Stack>
        <Money paise={expense.amount} />
      </Inline>
      {canDecide && expense.status === 'requested' ? <Decision venueId={venueId} expense={expense} /> : null}
      <Receipt expense={expense} />
    </Stack>
  );
}

/** The venue's expenses (#95), those waiting first: to whom, from which account, who asked and who decided. */
export function ExpenseList({ venueId, canDecide }: { venueId: string; canDecide: boolean }) {
  const expenses = useVenueExpenses(venueId);
  return (
    <Stack gap={4}>
      <Heading level={2}>{t('console.expenses.list')}</Heading>
      {expenses.isPending ? <LoadState /> : null}
      {expenses.isError ? (
        <LoadState isError onRetry={() => void expenses.refetch()} />
      ) : null}
      {expenses.data?.length === 0 ? <Text tone="muted">{t('console.expenses.listEmpty')}</Text> : null}
      <Stack gap={4} divided>
        {(expenses.data ?? []).map((expense) => <ExpenseRow key={expense.id} venueId={venueId} expense={expense} canDecide={canDecide} />)}
      </Stack>
    </Stack>
  );
}
