import { t } from '@rivr/i18n';
import { Screen } from '@rivr/ui';

/** Shown for an address the app does not have. */
export function NotFound() {
  return <Screen title={t('common.notFoundTitle')} status="error" errorText={t('common.notFound')} />;
}
