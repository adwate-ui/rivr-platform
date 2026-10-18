import { useT } from '@rivr/i18n';
import { Text } from '@rivr/ui';

/** The driver's pickups. Lane C builds the trip flow. */
export function PickupsScreen() {
  const t = useT();
  return <Text tone="muted">{t('driver.pickups.empty')}</Text>;
}
