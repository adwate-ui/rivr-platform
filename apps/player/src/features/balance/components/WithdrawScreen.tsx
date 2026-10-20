import { zodResolver } from '@hookform/resolvers/zod';
import { withdrawalSchema } from '@rivr/contracts';
import { usePayoutAccounts, useWallet, useWithdrawalActions, useWithdrawals, type PayoutAccount, type Wallet, type WithdrawalFailure } from '@rivr/db';
import { fromRupees } from '@rivr/domain/money';
import { withdrawalCheck } from '@rivr/domain/wallet';
import { formatMoney, t, type MessageKey } from '@rivr/i18n';
import { Button, ChoiceChips, ErrorMessage, Input, Screen, Stack, Text } from '@rivr/ui';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import type { z } from 'zod';
import { payoutLine } from './payoutCopy.ts';
import { withdrawBlock } from './withdrawBlock.ts';

/** What the member is told when a withdrawal is refused. */
const FAILURE_COPY: Readonly<Record<WithdrawalFailure, MessageKey>> = {
  wallet_short: 'player.balance.withdrawInvalid',
  invalid: 'player.balance.withdrawInvalid',
  kyc_needed: 'player.balance.withdrawKycNeeded',
  not_verified: 'player.balance.withdrawNotVerified',
  already_waiting: 'player.balance.withdrawAlreadyWaiting',
  marker_past_due: 'player.balance.withdrawMarkerPastDue',
  needs_second: 'player.balance.withdrawUnavailable',
  utr_used: 'player.balance.withdrawUnavailable',
  switched_off: 'player.balance.withdrawSwitchedOff',
  paused: 'player.balance.withdrawPaused',
  stopped: 'player.balance.withdrawStopped',
  not_allowed: 'player.balance.withdrawNotAllowed',
  unavailable: 'player.balance.withdrawUnavailable',
};

type Form = z.input<typeof withdrawalSchema>;

/** The amount's own error: not whole rupees, or more than the wallet holds (@rivr/domain withdrawalCheck). */
function amountError(typed: string, isInvalid: boolean, cash: Wallet['cash']): string | undefined {
  if (isInvalid) return t('player.balance.withdrawAmountInvalid');
  if (!/^[1-9]\d{0,7}$/.test(typed.trim())) return undefined;
  const checked = withdrawalCheck(fromRupees(BigInt(typed.trim())), cash);
  return !checked.ok && checked.error === 'wallet_short' ? t('player.balance.withdrawWalletShort', { amount: formatMoney(cash) }) : undefined;
}

/** The form itself: the amount, the verified account it goes to, and Confirm withdrawal; blocked up front as the prototype has it. */
function WithdrawForm({ wallet, accounts, block }: { wallet: Wallet; accounts: readonly PayoutAccount[]; block: MessageKey | null }) {
  const { request } = useWithdrawalActions();
  const navigate = useNavigate();
  const [requestId] = useState(() => crypto.randomUUID());
  const [resolver] = useState(() => zodResolver(withdrawalSchema));
  const form = useForm<Form, unknown, z.output<typeof withdrawalSchema>>({ resolver, defaultValues: { amount: '', payoutAccountId: accounts[0]?.accountId ?? '' } });
  const typed = useWatch({ control: form.control, name: 'amount' });
  const tooMuch = amountError(typed, Boolean(form.formState.errors.amount), wallet.cash);
  const send = form.handleSubmit(async (values) => {
    const amount = fromRupees(BigInt(values.amount));
    if (!withdrawalCheck(amount, wallet.cash).ok) return;
    const done = await request.mutateAsync({ amount, payoutAccountId: values.payoutAccountId, requestId });
    if (done.ok) void navigate({ to: '/balance' });
  });
  const amountField = form.register('amount');
  return (
    <Stack gap={4}>
      {block === null ? null : <ErrorMessage>{t(block)}</ErrorMessage>}
      <Input {...amountField} variant="line" label={t('player.balance.amount')} prefix={t('player.balance.rupee')} inputMode="numeric" maxLength={8} autoComplete="off"
        hint={t('player.balance.cashAvailable', { amount: formatMoney(wallet.cash) })} error={tooMuch} />
      <Controller control={form.control} name="payoutAccountId" render={({ field }) => (
        <ChoiceChips label={t('player.balance.withdrawTo')} mode="one" selected={[field.value]}
          options={accounts.map((account) => ({ value: account.accountId, label: payoutLine(account) }))}
          onChange={([value]) => field.onChange(value ?? field.value)} />
      )} />
      {request.data?.ok === false ? <ErrorMessage>{t(FAILURE_COPY[request.data.error])}</ErrorMessage> : null}
      <Button variant="primary" fullWidth isDisabled={block !== null} isLoading={request.isPending} onClick={() => void send()}>{t('player.balance.confirmWithdrawal')}</Button>
    </Stack>
  );
}

/**
 * Withdraw (#21; design prompt flow 9): an amount in whole rupees, no more than the wallet's cash, to
 * one of the member's verified payout accounts (#19). It leaves the wallet at once and waits for the
 * cage; Balance shows it pending, then sent with its UTR.
 */
export function WithdrawScreen() {
  const wallet = useWallet();
  const accounts = usePayoutAccounts();
  const withdrawals = useWithdrawals();
  const navigate = useNavigate();
  // The moment the screen opened: what is overdue now, not as it re-renders.
  const [now] = useState(() => new Date());
  const title = t('player.balance.withdraw');
  const back = <Button variant="text" onClick={() => void navigate({ to: '/balance' })}>{t('common.back')}</Button>;
  if (wallet.isPending || accounts.isPending) return <Screen title={title} actions={back} status="loading" />;
  if (wallet.isError || accounts.isError || wallet.data === null) {
    return <Screen title={title} actions={back} status="error" onRetry={() => void Promise.all([wallet.refetch(), accounts.refetch()])} />;
  }
  const verified = accounts.data.filter((account) => account.status === 'verified');
  return (
    <Screen title={title} actions={back}>
      {verified.length === 0 ? <Text tone="muted">{t('player.balance.noVerifiedAccount')}</Text> : (
        <WithdrawForm wallet={wallet.data} accounts={verified} block={withdrawBlock(wallet.data.markers, withdrawals.data ?? [], now)} />
      )}
    </Screen>
  );
}
