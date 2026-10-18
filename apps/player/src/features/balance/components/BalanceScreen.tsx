import { useT } from '@rivr/i18n';
import { Screen } from '@rivr/ui';

/** Balance is a core feature: never gated, so a member always sees their own money. Lane A builds it out. */
export function BalanceScreen() {
  const t = useT();
  return <Screen title={t('player.balance.title')} status="empty" emptyText={t('player.balance.empty')} />;
}
