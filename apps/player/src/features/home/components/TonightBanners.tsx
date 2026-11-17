import { useRestrictions } from '@rivr/db';
import { formatDateTime, formatTime, t } from '@rivr/i18n';
import { Banner, Stack, useIsOnline } from '@rivr/ui';
import type { ReactNode } from 'react';

export interface TonightBannersProps {
  /** When the tables shown last came from the server: the time an offline or failed banner names. */
  shownAt: number;
  /** A refresh failed while the screen still holds what came before. */
  hasRefreshFailed: boolean;
  onRetry: () => void;
  /** Seated, in the call time's last 15 minutes: the minutes left and Add time. */
  callEnding?: { minutes: number; onAddTime: () => void } | undefined;
  /** The frame's new-version banner with Refresh (#1053), through the route; it draws nothing while none waits. */
  newVersion?: ReactNode;
}

/** During a break (#56, decision 0300): until when tables are closed to the member, as long as it lasts. */
function BreakBanner() {
  const breakUntil = useRestrictions().data?.breakUntil ?? null;
  return breakUntil === null ? null : <Banner>{t('player.tonight.breakActive', { until: formatDateTime(new Date(breakUntil)) })}</Banner>;
}

/**
 * The banners at the top of Tonight (decision 0320), the only alerts inside the app: a new version with Refresh (#1053),
 * a break, a refresh that failed with Retry, the call time ending with Add time, and offline. Stacked 8 px apart; nothing
 * when there are none.
 * The club's notices are cards under them, not banners (TonightNotices, decision 0424).
 */
export function TonightBanners({ shownAt, hasRefreshFailed, onRetry, callEnding, newVersion }: TonightBannersProps) {
  const isOnline = useIsOnline();
  const time = formatTime(new Date(shownAt));
  return (
    <Stack gap={2}>
      {newVersion}
      <BreakBanner />
      {hasRefreshFailed && isOnline ? (
        <Banner action={{ label: t('player.alerts.retry'), onPress: onRetry }}>{t('player.alerts.failed', { time })}</Banner>
      ) : null}
      {callEnding ? (
        <Banner action={{ label: t('player.alerts.addTime'), onPress: callEnding.onAddTime }}>
          {t('player.alerts.callEnding', { minutes: callEnding.minutes })}
        </Banner>
      ) : null}
      {isOnline ? null : <Banner>{t('player.alerts.offline', { time })}</Banner>}
    </Stack>
  );
}
