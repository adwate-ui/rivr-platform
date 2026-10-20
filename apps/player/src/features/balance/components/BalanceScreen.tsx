import { useWallet, useWalletMovements } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Screen, Stack } from '@rivr/ui';
import { useState } from 'react';
import { MarkersSection } from './MarkersSection.tsx';
import { MovementsSection } from './MovementsSection.tsx';
import { WalletSummary } from './WalletSummary.tsx';

const PAGE = 30;

/**
 * Balance (#18; design prompt "Balance"), a core feature never gated, so a member always sees their own
 * money: wallet cash, bonus in force with when it expires, and points together; open markers against
 * the credit limit; and every movement on their accounts, newest first. Withdraw and Deposit come with
 * #21 and #29.
 */
export function BalanceScreen() {
  const [count, setCount] = useState(PAGE);
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
        <WalletSummary wallet={wallet.data} />
        <MarkersSection wallet={wallet.data} />
        <MovementsSection movements={movements.data.movements} hasEarlier={movements.data.hasEarlier}
          isLoadingEarlier={movements.isPlaceholderData} onShowEarlier={() => setCount((shown) => shown + PAGE)} />
      </Stack>
    </Screen>
  );
}
