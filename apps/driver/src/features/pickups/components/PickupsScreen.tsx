import { t } from '@rivr/i18n';
import { Text } from '@rivr/ui';

/** The driver's pickups. Lane C builds the trip flow. */
export function PickupsScreen() {
  return <Text tone="muted">{t('driver.pickups.empty')}</Text>;
}
