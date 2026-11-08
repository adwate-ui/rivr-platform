import { t } from '@rivr/i18n';
import { Button } from '../Button/Button.tsx';
import { Heading } from '../Heading/Heading.tsx';
import { Text } from '../Text/Text.tsx';

export interface LoadStateProps {
  /** It failed: says so, then offers Retry when `onRetry` is given. Otherwise it is still loading. */
  isError?: boolean;
  /** What happened, then what to do. Defaults to the shared load error. */
  errorText?: string | undefined;
  onRetry?: (() => void) | undefined;
  /** `serif`: a whole player screen that failed, centred as the prototype draws it, a serif line over what to do (F-176). */
  look?: 'default' | 'serif' | undefined;
}

/**
 * Something still loading, or that failed to load, with Retry: the same words and roles wherever a list or panel waits
 * (#462), as Screen shows them for a whole screen. Loading is announced politely (`status`), a failure at once (`alert`).
 */
export function LoadState({ isError = false, errorText, onRetry, look = 'default' }: LoadStateProps) {
  if (!isError) {
    return (
      <div role="status">
        <Text tone="muted">{t('common.loading')}</Text>
      </div>
    );
  }
  if (look === 'serif') {
    return (
      <div role="alert" className="flex flex-col items-center gap-3 pt-16 text-center">
        <Heading level={2} variant="serif" serifSize={28} align="center">{t('common.loadFailedTitle')}</Heading>
        <Text tone="muted" align="center">{errorText ?? t('common.checkConnection')}</Text>
        {onRetry ? <Button variant="outline" onClick={onRetry}>{t('common.retry')}</Button> : null}
      </div>
    );
  }
  return (
    <div role="alert" className="flex flex-col items-start gap-3">
      <Text>{errorText ?? t('common.loadFailed')}</Text>
      {onRetry ? <Button onClick={onRetry}>{t('common.retry')}</Button> : null}
    </div>
  );
}
