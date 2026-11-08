import { t } from '@rivr/i18n';
import type { ReactNode } from 'react';
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
  /** With `serif`: its line, where the failure is not "Could not load", such as "No connection". */
  title?: string | undefined;
  /** With `serif`: anything the member still needs, under the line, such as the number to give at the door. */
  children?: ReactNode;
}

/**
 * Something still loading, or that failed to load, with Retry: the same words and roles wherever a list or panel waits
 * (#462), as Screen shows them for a whole screen. Loading is announced politely (`status`), a failure at once (`alert`).
 */
export function LoadState({ isError = false, errorText, onRetry, look = 'default', title, children }: LoadStateProps) {
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
        <Heading level={2} variant="serif" serifSize={28} align="center">{title ?? t('common.loadFailedTitle')}</Heading>
        {children}
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
