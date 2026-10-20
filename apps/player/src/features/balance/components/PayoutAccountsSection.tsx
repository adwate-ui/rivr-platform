import { usePayoutAccountActions, usePayoutAccounts, type PayoutAccount } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, Divider, ErrorMessage, Heading, Inline, Stack, Text } from '@rivr/ui';
import { useId, useState } from 'react';
import { AddPayoutAccount } from './AddPayoutAccount.tsx';
import { payoutLine, payoutStatus, PAYOUT_FAILURE_COPY } from './payoutCopy.ts';

/** One account: which, where it stands (verified in gold), and Remove, described by the account it removes. */
function AccountRow({ account }: { account: PayoutAccount }) {
  const { remove } = usePayoutAccountActions();
  const lineId = useId();
  return (
    <Stack gap={2}>
      <Inline gap={4} justify="between">
        <Stack gap={1} grow>
          <Text id={lineId}>{payoutLine(account)}</Text>
          <Text variant="small" tone={account.status === 'verified' ? 'money' : 'muted'}>{payoutStatus(account)}</Text>
        </Stack>
        <Button variant="text" isLoading={remove.isPending} aria-describedby={lineId} onClick={() => void remove.mutateAsync(account.accountId)}>
          {t('player.balance.removePayout')}
        </Button>
      </Inline>
      {remove.data?.ok === false ? <ErrorMessage>{t(PAYOUT_FAILURE_COPY[remove.data.error])}</ErrorMessage> : null}
    </Stack>
  );
}

/**
 * Payout accounts on Balance (#19; design prompt: "HDFC Bank, UPI verified"): where withdrawals go,
 * each usable once the cage verifies it, and the way to add one.
 */
export function PayoutAccountsSection() {
  const accounts = usePayoutAccounts();
  const [isAdding, setIsAdding] = useState(false);
  const [wasAdded, setWasAdded] = useState(false);
  return (
    <Stack gap={3}>
      <Heading level={2}>{t('player.balance.payoutAccounts')}</Heading>
      <Divider />
      {accounts.isPending ? <Text tone="muted">{t('common.loading')}</Text> : null}
      {accounts.isError ? (
        <Stack gap={2} align="start">
          <ErrorMessage>{t('player.balance.payoutsUnavailable')}</ErrorMessage>
          <Button onClick={() => void accounts.refetch()}>{t('common.retry')}</Button>
        </Stack>
      ) : null}
      {accounts.data?.length === 0 ? <Text tone="muted">{t('player.balance.noPayoutAccounts')}</Text> : null}
      {(accounts.data ?? []).map((account) => <AccountRow key={account.accountId} account={account} />)}
      {wasAdded && !isAdding ? <Text tone="muted">{t('player.balance.payoutAdded')}</Text> : null}
      {isAdding ? (
        <AddPayoutAccount onDone={(added) => { setIsAdding(false); setWasAdded(added); }} />
      ) : (
        <Button variant="secondary" onClick={() => { setIsAdding(true); setWasAdded(false); }}>{t('player.balance.addPayoutAccount')}</Button>
      )}
    </Stack>
  );
}
