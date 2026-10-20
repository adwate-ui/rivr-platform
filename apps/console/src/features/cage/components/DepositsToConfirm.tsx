import { zodResolver } from '@hookform/resolvers/zod';
import { bankAmountSchema } from '@rivr/contracts';
import { useDepositDecisions, useStaffVenue, useWaitingDeposits, type DepositFailure, type WaitingDeposit } from '@rivr/db';
import { fromRupees } from '@rivr/domain/money';
import { formatDayTime, t, type MessageKey } from '@rivr/i18n';
import { Button, ErrorMessage, Heading, Inline, Input, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

/** Why a deposit was not confirmed or turned down, for the cashier. */
const FAILURE_COPY: Readonly<Record<DepositFailure, MessageKey>> = {
  not_allowed: 'console.cage.depositNotAllowed',
  invalid: 'console.cage.depositNotWaiting',
  kyc_needed: 'console.cage.depositNotWaiting',
  not_verified: 'console.cage.depositNotWaiting',
  utr_used: 'console.cage.depositNotWaiting',
  too_many: 'console.cage.depositNotWaiting',
  amount_mismatch: 'console.cage.depositAmountMismatch',
  needs_second: 'console.withdrawals.needsSecondFailure',
  paused: 'console.cage.payoutPaused',
  stopped: 'console.cage.payoutStopped',
  unavailable: 'console.cage.payoutUnavailable',
};

/** The second approver's state, as on withdrawals: who has approved, or that one is still needed. */
function secondLine(deposit: WaitingDeposit): string | null {
  if (!deposit.needsSecond) return null;
  if (deposit.approvedBy.length > 0) return t('console.withdrawals.approvedBy', { names: deposit.approvedBy.join(', ') });
  return t('console.withdrawals.needsSecond');
}

/**
 * One waiting deposit: whose, its UTR and when, and the UPI account it came from, to find in the bank
 * statement; the amount the bank shows, then Confirm received; Not found; and, from the threshold up,
 * Approve as second approver (#20).
 */
function DepositRow({ venueId, deposit, canSecond }: { venueId: string; deposit: WaitingDeposit; canSecond: boolean }) {
  const { confirm, reject, secondApprove } = useDepositDecisions(venueId);
  const [failure, setFailure] = useState<DepositFailure | null>(null);
  const [resolver] = useState(() => zodResolver(bankAmountSchema));
  const form = useForm<z.input<typeof bankAmountSchema>, unknown, z.output<typeof bankAmountSchema>>({ resolver, defaultValues: { amount: '' } });
  const settle = (done: { ok: true } | { ok: false; error: DepositFailure }) => setFailure(done.ok ? null : done.error);
  const confirmIt = form.handleSubmit(async ({ amount }) => settle(await confirm.mutateAsync({ depositId: deposit.depositId, bankAmount: fromRupees(BigInt(amount)) })));
  const amount = form.register('amount');
  const second = secondLine(deposit);
  return (
    <Stack gap={2}>
      <Stack gap={1}>
        <Text weight="medium">{deposit.fullName}</Text>
        <Text variant="small" tone="muted">{t('console.cage.depositLine', { utr: deposit.utr, time: formatDayTime(new Date(deposit.requestedAt)) })}</Text>
        <Text variant="small">{t('console.cage.depositFrom', { vpa: deposit.fromVpa ?? '', bank: deposit.fromBank })}</Text>
        {second === null ? null : <Text variant="small" tone="muted">{second}</Text>}
      </Stack>
      <Inline gap={3} align="end" wrap>
        <Input {...amount} label={t('console.cage.amountInBank')} prefix={t('console.cage.rupee')} inputMode="numeric" maxLength={8} autoComplete="off"
          error={form.formState.errors.amount ? t('console.cage.amountInBankInvalid') : undefined} />
        <Button variant="secondary" isLoading={confirm.isPending} onClick={() => void confirmIt()}>{t('console.cage.confirmReceived')}</Button>
        {canSecond && deposit.needsSecond ? (
          <Button variant="secondary" isLoading={secondApprove.isPending} onClick={() => void secondApprove.mutateAsync(deposit.depositId).then(settle)}>
            {t('console.withdrawals.secondApprove')}
          </Button>
        ) : null}
        <Button variant="text" isLoading={reject.isPending} onClick={() => void reject.mutateAsync(deposit.depositId).then(settle)}>
          {t('console.cage.depositNotFound')}
        </Button>
      </Inline>
      {failure === null ? null : <ErrorMessage>{t(FAILURE_COPY[failure])}</ErrorMessage>}
    </Stack>
  );
}

/**
 * UPI deposits waiting for the cage (#29, decision 0064): the cashier finds each UTR in the bank
 * statement, checks the payer, and types the amount the bank shows to confirm it, crediting the wallet;
 * or turns it down as not found.
 */
export function DepositsToConfirm({ venueId }: { venueId: string }) {
  const waiting = useWaitingDeposits(venueId);
  const staff = useStaffVenue();
  const canSecond = staff.status === 'ready' && staff.venue.permissions.includes('cage.second_approve');
  return (
    <Stack gap={3} divided>
      <Heading level={2}>{t('console.cage.depositsToConfirm')}</Heading>
      {waiting.isPending ? <Text tone="muted">{t('common.loading')}</Text> : null}
      {waiting.isError ? (
        <Stack gap={2} align="start">
          <ErrorMessage>{t('console.cage.unavailable')}</ErrorMessage>
          <Button onClick={() => void waiting.refetch()}>{t('common.retry')}</Button>
        </Stack>
      ) : null}
      {waiting.data?.length === 0 ? <Text tone="muted">{t('console.cage.depositsEmpty')}</Text> : null}
      {(waiting.data ?? []).map((deposit) => <DepositRow key={deposit.depositId} venueId={venueId} deposit={deposit} canSecond={canSecond} />)}
    </Stack>
  );
}
