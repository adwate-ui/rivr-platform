import { t } from '@rivr/i18n';
import { Button } from '../Button/Button.tsx';
import { Text } from '../Text/Text.tsx';

export interface LoadStateProps {
  /** It failed: says so, then offers Retry when `onRetry` is given. Otherwise it is still loading. */
  isError?: boolean;
  /** What happened, then what to do. Defaults to the shared load error. */
  errorText?: string | undefined;
  onRetry?: (() => void) | undefined;
}

/**
 * Something still loading, or that failed to load, with Retry: the same words and roles wherever a list or panel waits
 * (#462), as Screen shows them for a whole screen. Loading is announced politely (`status`), a failure at once (`alert`).
 */
export function LoadState({ isError = false, errorText, onRetry }: LoadStateProps) {
  if (!isError) {
    return (
      <div role="status">
        <Text tone="muted">{t('common.loading')}</Text>
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
