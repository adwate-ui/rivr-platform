import { zodResolver } from '@hookform/resolvers/zod';
import { depositSchema } from '@rivr/contracts';
import { useDepositActions, useDepositDetails, useFeature, usePayoutAccounts, type DepositDetails, type DepositFailure, type PayoutAccount } from '@rivr/db';
import { fromRupees } from '@rivr/domain/money';
import { t, type MessageKey } from '@rivr/i18n';
import { Button, ChoiceChips, ErrorMessage, FeatureGate, Inline, Input, Screen, Stack, Text } from '@rivr/ui';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { payoutLine } from './payoutCopy.ts';
import type { z } from 'zod';

/** What the member is told when a deposit is refused. */
const FAILURE_COPY: Readonly<Record<DepositFailure, MessageKey>> = {
  // The cage's own refusal; no member's request meets it.
  no_shift: 'player.balance.depositUnavailable',
  not_allowed: 'player.balance.depositNotAllowed',
  invalid: 'player.balance.depositInvalid',
  kyc_needed: 'player.balance.depositKycNeeded',
  not_verified: 'player.balance.depositNotVerified',
  utr_used: 'player.balance.depositUtrUsed',
  too_many: 'player.balance.depositTooMany',
  amount_mismatch: 'player.balance.depositUnavailable',
  needs_second: 'player.balance.depositUnavailable',
  paused: 'player.balance.withdrawPaused',
  stopped: 'player.balance.withdrawStopped',
  unavailable: 'player.balance.depositUnavailable',
};

/** One fact of where to pay, as the prototype lays it out: what, then the value. */
function Fact({ label, value }: { label: string; value: string }) {
  return (
    <Inline gap={4} justify="between">
      <Text tone="muted">{label}</Text>
      <Text>{value}</Text>
    </Inline>
  );
}

/** The form: where to pay, the verified UPI account it comes from, then the amount paid and its UTR, and Submit. */
function DepositForm({ details, accounts }: { details: DepositDetails; accounts: readonly PayoutAccount[] }) {
  const { request } = useDepositActions();
  const navigate = useNavigate();
  const [requestId] = useState(() => crypto.randomUUID());
  const [resolver] = useState(() => zodResolver(depositSchema));
  const form = useForm<z.input<typeof depositSchema>, unknown, z.output<typeof depositSchema>>({ resolver, defaultValues: { amount: '', utr: '', payoutAccountId: accounts[0]?.accountId ?? '' } });
  const send = form.handleSubmit(async (values) => {
    const done = await request.mutateAsync({ amount: fromRupees(BigInt(values.amount)), utr: values.utr, payoutAccountId: values.payoutAccountId, requestId });
    if (done.ok) void navigate({ to: '/balance' });
  });
  const amount = form.register('amount');
  const utr = form.register('utr');
  return (
    <Stack gap={4}>
      <Fact label={t('player.balance.payToUpi')} value={details.upiVpa} />
      <Fact label={t('player.balance.payeeName')} value={details.payeeName} />
      <Controller control={form.control} name="payoutAccountId" render={({ field }) => (
        <ChoiceChips label={t('player.balance.depositFrom')} mode="one" selected={[field.value]}
          options={accounts.map((account) => ({ value: account.accountId, label: payoutLine(account) }))}
          onChange={([value]) => field.onChange(value ?? field.value)} />
      )} />
      <Input {...amount} variant="line" label={t('player.balance.amountPaid')} prefix={t('player.balance.rupee')} inputMode="numeric" maxLength={8}
        autoComplete="off" error={form.formState.errors.amount ? t('player.balance.depositAmountInvalid') : undefined} />
      <Input {...utr} label={t('player.balance.utr')} inputMode="numeric" maxLength={12} autoComplete="off"
        error={form.formState.errors.utr ? t('player.balance.depositUtrInvalid') : undefined} />
      {request.data?.ok === false ? <ErrorMessage>{t(FAILURE_COPY[request.data.error])}</ErrorMessage> : null}
      <Button variant="primary" fullWidth isLoading={request.isPending} onClick={() => void send()}>{t('player.balance.submitDeposit')}</Button>
    </Stack>
  );
}

function DepositBody() {
  const details = useDepositDetails();
  const accounts = usePayoutAccounts();
  if (details.isPending || accounts.isPending) return <Text tone="muted">{t('common.loading')}</Text>;
  if (details.isError || accounts.isError) return <ErrorMessage>{t('player.balance.depositUnavailable')}</ErrorMessage>;
  if (details.data === null) return <Text tone="muted">{t('player.balance.noDepositDetails')}</Text>;
  const upi = accounts.data.filter((account) => account.kind === 'upi' && account.status === 'verified');
  return upi.length === 0 ? <Text tone="muted">{t('player.balance.noUpiAccount')}</Text> : <DepositForm details={details.data} accounts={upi} />;
}

/**
 * Deposit (#29; design prompt Deposit), gated by the tier's balance.deposits: the club's UPI address
 * and name to pay from one of the member's verified UPI accounts, then the amount paid and its UTR. The cage confirms it against
 * the bank statement; Balance shows it submitted, then received.
 */
export function DepositScreen() {
  const navigate = useNavigate();
  const back = <Button variant="text" onClick={() => void navigate({ to: '/balance' })}>{t('common.back')}</Button>;
  return (
    <Screen title={t('player.balance.deposit')} actions={back}>
      <FeatureGate access={useFeature('balance.deposits')}>
        <DepositBody />
      </FeatureGate>
    </Screen>
  );
}
