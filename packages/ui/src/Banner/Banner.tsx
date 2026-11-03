import { t } from '@rivr/i18n';
import type { ReactNode } from 'react';
import { Icon } from '../Icon/Icon.tsx';
import { cx } from '../internal/classes.ts';

/** `neutral` informs (a notice, offline, a refresh that failed); `alert` blocks the member (the club is paused). */
export type BannerTone = 'neutral' | 'alert';

export interface BannerProps {
  /** One line: the fact. */
  children: ReactNode;
  tone?: BannerTone;
  /** The one thing to do about it, such as Retry or Add time. */
  action?: { label: string; onPress: () => void } | undefined;
  /** Shows the × that hides the banner. An alert banner is never dismissed. */
  onDismiss?: (() => void) | undefined;
}

const TONE: Record<BannerTone, string> = {
  neutral: 'border-gold-edge bg-raised text-content',
  alert: 'border-alert bg-alert text-on-alert',
};

const ACTION =
  'inline-flex min-h-touch shrink-0 items-center rounded-md border border-control px-3 font-text text-13 leading-control font-semibold text-inherit';

/**
 * A line at the top of Tonight (decision 0320): a club notice, offline, a refresh that failed, the call time ending, or the
 * club paused in red. It may carry one action and, when neutral, a dismiss. Read out politely as it appears.
 */
export function Banner({ children, tone = 'neutral', action, onDismiss }: BannerProps) {
  return (
    <div role="status" className={cx('flex min-h-12 items-center gap-3 rounded-lg border py-2 pr-2 pl-4', TONE[tone])}>
      <span className={cx('flex shrink-0', tone === 'neutral' ? 'text-accent' : 'text-on-alert')}>
        <Icon name="info" size="md" />
      </span>
      <span className="min-w-0 flex-1 font-text text-14 leading-snug font-medium">{children}</span>
      {action ? (
        <button type="button" className={ACTION} onClick={action.onPress}>{action.label}</button>
      ) : null}
      {onDismiss && tone === 'neutral' ? (
        <button type="button" aria-label={t('ui.banner.dismiss')} onClick={onDismiss}
          className="flex size-touch shrink-0 items-center justify-center text-content-muted">
          <Icon name="close" size="sm" />
        </button>
      ) : null}
    </div>
  );
}
