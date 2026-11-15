import { t } from '@rivr/i18n';
import { Text, TvStage } from '@rivr/ui';

/** Shown for an address the app does not have. */
export function NotFound() {
  return <TvStage><Text variant="tvBody">{t('common.notFound')}</Text></TvStage>;
}
