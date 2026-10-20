import type { Wallet, WalletBonus } from '@rivr/db';
import { formatDayTime, formatMoney, formatNumber, formatTime, formatWeekday, t } from '@rivr/i18n';
import { Money, Stack, Text } from '@rivr/ui';

const DAY_MS = 24 * 60 * 60 * 1000;
// India time is UTC+5:30 all year: the IST calendar day of an instant.
const istDay = (at: Date) => Math.floor((at.getTime() + 5.5 * 60 * 60 * 1000) / DAY_MS);

/**
 * A bonus grant and its end: the weekday when it ends within the next six IST days ("expires Sunday
 * 23:59"), or the date after that, so a week on never reads as today.
 */
function bonusLine(bonus: WalletBonus, now: Date): string {
  const end = new Date(bonus.expiresAt);
  const amount = formatMoney(bonus.remaining);
  if (istDay(end) - istDay(now) <= 6) return t('player.balance.bonusLine', { amount, day: formatWeekday(end), time: formatTime(end) });
  return t('player.balance.bonusLineLater', { amount, when: formatDayTime(end) });
}

/**
 * The top of Balance (design prompt "Balance"): wallet cash in gold, each bonus grant in force with
 * when it expires (#17), and points, shown together; points never turn into cash.
 */
export function WalletSummary({ wallet }: { wallet: Wallet }) {
  const now = new Date();
  return (
    <Stack gap={2}>
      <Text variant="small" tone="muted">{t('player.balance.cash')}</Text>
      <Money paise={wallet.cash} size="title" tone="player" />
      {wallet.bonus.map((bonus) => (
        <Text key={bonus.grantId} tone="money">{bonusLine(bonus, now)}</Text>
      ))}
      <Text tone="muted">{t('player.balance.points', { points: formatNumber(wallet.points) })}</Text>
    </Stack>
  );
}
