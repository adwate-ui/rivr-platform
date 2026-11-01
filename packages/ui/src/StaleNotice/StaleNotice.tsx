import { formatTime, t } from '@rivr/i18n';
import { Button } from '../Button/index.ts';
import { ErrorMessage } from '../ErrorMessage/ErrorMessage.tsx';

export interface StaleNoticeProps {
  /** When what the screen shows last came. */
  since: Date;
  /** Asks again; without it, as on a TV no one touches, the notice only says so. */
  onRetry?: (() => void) | undefined;
}

/**
 * What a screen shows has stopped refreshing (a weak signal, a dropped connection): when it last came, and a way to ask
 * again. The screen keeps what it had, so a board stays readable and a form half typed is not lost to a failed refresh.
 */
export function StaleNotice({ since, onRetry }: StaleNoticeProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <ErrorMessage>{t('ui.staleNotice', { time: formatTime(since) })}</ErrorMessage>
      {onRetry ? <Button variant="text" onClick={onRetry}>{t('common.retry')}</Button> : null}
    </div>
  );
}
