import { useWallet, useWalletMovements } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, Screen, Stack } from '@rivr/ui';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
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
 * Withdraw (#21) opens its own screen, and the latest withdrawal shows here; Deposit comes with #29.
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
          <Button variant="primary" onClick={() => void navigate({ to: '/balance/withdraw' })}>{t('player.balance.withdraw')}</Button>
        </Stack>
        <MarkersSection wallet={wallet.data} />
        <PayoutAccountsSection />
        <MovementsSection movements={movements.data.movements} hasEarlier={movements.data.hasEarlier}
          isLoadingEarlier={movements.isPlaceholderData} onShowEarlier={() => setCount((shown) => shown + PAGE)} />
      </Stack>
    </Screen>
  );
}
