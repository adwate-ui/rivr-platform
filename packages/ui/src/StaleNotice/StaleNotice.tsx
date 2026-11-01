import { formatTime, t } from '@rivr/i18n';
import { Button } from '../Button/index.ts';
import { ErrorMessage } from '../ErrorMessage/ErrorMessage.tsx';
import { Icon } from '../Icon/Icon.tsx';
import { Text } from '../Text/Text.tsx';

export interface StaleNoticeProps {
  /** When what the screen shows last came. */
  since: Date;
  /** Asks again; without it the notice only says so. */
  onRetry?: (() => void) | undefined;
  /**
   * `tv`: read across a room, so at the TV's body size, muted, and said politely rather than as an alert, as a TV asks
   * again every few seconds; nothing on it can be pressed, so it has no Try again.
   */
  variant?: 'screen' | 'tv' | undefined;
}

/**
 * What a screen shows has stopped refreshing (a weak signal, a dropped connection): when it last came, and a way to ask
 * again. The screen keeps what it had, so a board stays readable and a form half typed is not lost to a failed refresh.
 */
export function StaleNotice({ since, onRetry, variant = 'screen' }: StaleNoticeProps) {
  if (variant === 'tv') {
    return (
      <div role="status" className="flex items-center gap-4 text-content-muted">
        <Icon name="alert" size="lg" />
        <Text variant="tvBody" tone="muted">{t('ui.staleNotice', { time: formatTime(since) })}</Text>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-3">
      <ErrorMessage>{t('ui.staleNotice', { time: formatTime(since) })}</ErrorMessage>
      {onRetry ? <Button variant="text" onClick={onRetry}>{t('common.retry')}</Button> : null}
    </div>
  );
}
