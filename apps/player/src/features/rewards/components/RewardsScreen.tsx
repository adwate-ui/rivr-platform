import { t } from '@rivr/i18n';
import { Screen } from '@rivr/ui';

/** Rewards: the tab always shows; the catalogue, League, referral and cab inside it are gated one by one. Lane D builds it out. */
export function RewardsScreen() {
  return <Screen title={t('player.rewards.title')} status="empty" emptyText={t('player.rewards.empty')} />;
}
