import { t } from '@rivr/i18n';
import { LoadState } from '@rivr/ui';

/** A board still reading, or unable to, in TV type (F-141). */
export function BoardStatus({ isError }: { isError: boolean }) {
  return <LoadState size="tv" isError={isError} errorText={t('display.screen.unavailable')} />;
}
