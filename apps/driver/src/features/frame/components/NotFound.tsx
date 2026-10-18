import { t } from '@rivr/i18n';
import { Text } from '@rivr/ui';

/** Shown for an address the app does not have. */
export function NotFound() {
  return <Text tone="muted">{t('common.notFound')}</Text>;
}
