import type { Wallet } from '@rivr/db';
import { formatChips, formatNumber, t } from '@rivr/i18n';
import { Money, Stack, Text } from '@rivr/ui';

/**
 * The top of Balance (design prompt "Balance"): wallet cash in gold, each bonus grant in force (#17; bonus chips never
 * expire, decision 0504), and points, shown together; points never turn into cash.
 */
export function WalletSummary({ wallet }: { wallet: Wallet }) {
  return (
    <Stack gap={2}>
      <Text variant="small" tone="muted">{t('player.balance.cash')}</Text>
      <Money paise={wallet.cash} size="title" tone="player" />
      {wallet.bonus.map((bonus) => (
        <Text key={bonus.grantId} tone="money">{t('player.balance.bonusLine', { chips: formatChips(bonus.remaining) })}</Text>
      ))}
      <Text tone="muted">{t('player.balance.points', { points: formatNumber(wallet.points) })}</Text>
    </Stack>
  );
}
