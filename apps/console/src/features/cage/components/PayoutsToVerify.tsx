import { zodResolver } from '@hookform/resolvers/zod';
import { reasonForMemberSchema } from '@rivr/contracts';
import { usePayoutAccountDecisions, usePayoutAccountsToVerify, type PayoutAccountToVerify } from '@rivr/db';
import { formatDayTime, formatMobile, t } from '@rivr/i18n';
import { Button, ErrorMessage, Heading, Inline, Input, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { PAYOUT_FAILURE_COPY } from './cageCopy.ts';

/** The account in one line: the UPI address, or the bank, number, IFSC and the name on it. */
function lineOf(account: PayoutAccountToVerify): string {
  if (account.kind === 'upi') return t('console.cage.payoutUpi', { vpa: account.vpa ?? '', bank: account.bankName });
  return t('console.cage.payoutBank', { bank: account.bankName, number: account.accountNumber ?? '', ifsc: account.ifsc ?? '', holder: account.holderName ?? '' });
}

/** Turning an account down: the reason the member will read, then Turn down. */
function RejectForm({ onReject, isSaving }: { onReject: (reason: string) => void; isSaving: boolean }) {
  const [resolver] = useState(() => zodResolver(reasonForMemberSchema));
  const form = useForm<z.input<typeof reasonForMemberSchema>, unknown, z.output<typeof reasonForMemberSchema>>({ resolver, defaultValues: { reason: '' } });
  const reason = form.register('reason');
  return (
    <Stack gap={2}>
      <Input {...reason} label={t('console.cage.rejectReason')} maxLength={200} autoComplete="off"
        error={form.formState.errors.reason ? t('console.cage.rejectReasonInvalid') : undefined} />
      <Button variant="danger" isLoading={isSaving} onClick={() => void form.handleSubmit((values) => onReject(values.reason))()}>
        {t('console.cage.confirmReject')}
      </Button>
    </Stack>
  );
}

/** One waiting account: whose (name, mobile, when added), which account, and Verify or Turn down. */
function AccountRow({ venueId, account }: { venueId: string; account: PayoutAccountToVerify }) {
  const { decide } = usePayoutAccountDecisions(venueId);
  const [isRejecting, setIsRejecting] = useState(false);
  const decideWith = (isVerified: boolean, reason: string | null) => void decide.mutateAsync({ accountId: account.accountId, isVerified, reason });
  return (
    <Stack gap={2}>
      <Inline gap={4} align="start" justify="between">
        <Stack gap={1}>
          <Text weight="medium">{account.fullName}</Text>
          <Text>{lineOf(account)}</Text>
          <Text variant="small" tone="muted">
            {t('console.cage.payoutAdded', { time: formatDayTime(new Date(account.addedAt)), phone: formatMobile(account.phone) })}
          </Text>
        </Stack>
        <Stack gap={1} align="end">
          <Button variant="secondary" isLoading={decide.isPending && !isRejecting} onClick={() => decideWith(true, null)}>{t('console.cage.verifyPayout')}</Button>
          <Button variant="text" onClick={() => setIsRejecting((open) => !open)}>{t('console.cage.rejectPayout')}</Button>
        </Stack>
      </Inline>
      {isRejecting ? <RejectForm isSaving={decide.isPending} onReject={(reason) => decideWith(false, reason)} /> : null}
      {decide.data?.ok === false ? <ErrorMessage>{t(PAYOUT_FAILURE_COPY[decide.data.error])}</ErrorMessage> : null}
    </Stack>
  );
}

/**
 * Payout accounts waiting for the cage (#19): members add them on Balance, and none can be paid to
 * until a cashier checks it against the member's KYC and verifies it, or turns it down with a reason.
 */
export function PayoutsToVerify({ venueId }: { venueId: string }) {
  const waiting = usePayoutAccountsToVerify(venueId);
  return (
    <Stack gap={3} divided>
      <Heading level={2}>{t('console.cage.payoutsToVerify')}</Heading>
      {waiting.isPending ? <Text tone="muted">{t('common.loading')}</Text> : null}
      {waiting.isError ? (
        <Stack gap={2} align="start">
          <ErrorMessage>{t('console.cage.unavailable')}</ErrorMessage>
          <Button onClick={() => void waiting.refetch()}>{t('common.retry')}</Button>
        </Stack>
      ) : null}
      {waiting.data?.length === 0 ? <Text tone="muted">{t('console.cage.payoutsEmpty')}</Text> : null}
      {(waiting.data ?? []).map((account) => <AccountRow key={account.accountId} venueId={venueId} account={account} />)}
    </Stack>
  );
}
