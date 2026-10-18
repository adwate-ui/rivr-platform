import { t } from '@rivr/i18n';
import { Text } from '@rivr/ui';

/** Before pairing, a TV says so. Lane B shows the six-digit pairing code and then the assigned mode. */
export function UnpairedScreen() {
  return <Text variant="tvBody">{t('display.unpaired')}</Text>;
}
