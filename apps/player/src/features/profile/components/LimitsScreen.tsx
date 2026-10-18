import { t } from '@rivr/i18n';
import { Screen } from '@rivr/ui';

/** Limits and self-exclusion. Until #56 builds them here, the front desk sets them. */
export function LimitsScreen() {
  return <Screen title={t('player.limits.title')} status="empty" emptyText={t('player.limits.empty')} />;
}
