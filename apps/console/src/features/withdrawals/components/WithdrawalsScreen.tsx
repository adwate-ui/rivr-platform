import { useStaffVenue, useWaitingWithdrawals } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Screen, Stack, StatusMessage, Text } from '@rivr/ui';
import { useState } from 'react';
import { WithdrawalRow } from './WithdrawalRow.tsx';

/**
 * Withdrawals (#21; design prompt flow 9): members' withdrawals waiting for the cage, oldest first. A
 * cashier sends each with the bank's UTR, or declines it; from the threshold up a second approver, on
 * their own console, approves it first (#20). The second approver may be a floor manager, who has no
 * cage, so this is its own screen.
 */
export function WithdrawalsScreen() {
  const staff = useStaffVenue();
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  const title = t('console.withdrawals.title');
  const canDecide = staff.venue.permissions.includes('withdrawals.approve');
  const canSecond = staff.venue.permissions.includes('cage.second_approve');
  if (!canDecide && !canSecond) return <Screen title={title} status="error" errorText={t('console.withdrawals.notAllowed')} />;
  return <Withdrawals title={title} venueId={staff.venue.venueId} canDecide={canDecide} canSecond={canSecond} />;
}

function Withdrawals({ title, venueId, canDecide, canSecond }: { title: string; venueId: string; canDecide: boolean; canSecond: boolean }) {
  const waiting = useWaitingWithdrawals(venueId);
  const [sentUtr, setSentUtr] = useState<string | null>(null);
  if (waiting.isPending) return <Screen title={title} status="loading" />;
  if (waiting.isError) return <Screen title={title} status="error" onRetry={() => void waiting.refetch()} />;
  return (
    <Screen title={title}>
      <Stack gap={6} divided>
        <StatusMessage>{sentUtr === null ? null : t('console.withdrawals.sent', { utr: sentUtr })}</StatusMessage>
        {waiting.data.length === 0 ? <Text tone="muted">{t('console.withdrawals.empty')}</Text> : null}
        {waiting.data.map((withdrawal) => (
          <WithdrawalRow key={withdrawal.withdrawalId} venueId={venueId} withdrawal={withdrawal} canDecide={canDecide} canSecond={canSecond} onSent={setSentUtr} />
        ))}
      </Stack>
    </Screen>
  );
}
