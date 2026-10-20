import { useWallet, useWalletMovements } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, Inline, Screen, Stack } from '@rivr/ui';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { DepositStatus } from './DepositStatus.tsx';
import { MarkersSection } from './MarkersSection.tsx';
import { MovementsSection } from './MovementsSection.tsx';
import { PayoutAccountsSection } from './PayoutAccountsSection.tsx';
import { WalletSummary } from './WalletSummary.tsx';
import { WithdrawalStatus } from './WithdrawalStatus.tsx';

const PAGE = 30;

/**
 * Balance (#18; design prompt "Balance"), a core feature never gated, so a member always sees their own
 * money: wallet cash, bonus in force with when it expires, and points together; open markers against
 * the credit limit; their payout accounts (#19); and every movement on their accounts, newest first.
 * Withdraw (#21) and Deposit (#29) open their own screens, and the latest of each shows here.
 */
export function BalanceScreen() {
  const [count, setCount] = useState(PAGE);
  const navigate = useNavigate();
  const wallet = useWallet();
  const movements = useWalletMovements(count);
  const title = t('player.balance.title');
  if (wallet.isPending || movements.isPending) return <Screen title={title} status="loading" />;
  if (wallet.isError || movements.isError || wallet.data === null) {
    return <Screen title={title} status="error" onRetry={() => void Promise.all([wallet.refetch(), movements.refetch()])} />;
  }
  return (
    <Screen title={title}>
      <Stack gap={8}>
        <Stack gap={4}>
          <WalletSummary wallet={wallet.data} />
          <WithdrawalStatus />
          <DepositStatus />
          <Inline gap={3}>
            <Button variant="primary" onClick={() => void navigate({ to: '/balance/withdraw' })}>{t('player.balance.withdraw')}</Button>
            <Button variant="text" onClick={() => void navigate({ to: '/balance/deposit' })}>{t('player.balance.deposit')}</Button>
          </Inline>
        </Stack>
        <MarkersSection wallet={wallet.data} />
        <PayoutAccountsSection />
        <MovementsSection movements={movements.data.movements} hasEarlier={movements.data.hasEarlier}
          isLoadingEarlier={movements.isPlaceholderData} onShowEarlier={() => setCount((shown) => shown + PAGE)} />
      </Stack>
    </Screen>
  );
}
