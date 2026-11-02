import { useControlState, useRestrictions } from '@rivr/db';
import type { Notice } from '@rivr/db/notices';
import { formatDateTime, formatTime, t } from '@rivr/i18n';
import { Banner, Stack, useIsOnline } from '@rivr/ui';
import { useState } from 'react';

export interface TonightBannersProps {
  /** The club's notices in force (decision 0298): shown, and dismissible, only while the member browses. */
  notices: readonly Notice[];
  isBrowsing: boolean;
  /** When the tables shown last came from the server: the time an offline or failed banner names. */
  shownAt: number;
  /** A refresh failed while the screen still holds what came before. */
  hasRefreshFailed: boolean;
  onRetry: () => void;
  /** Seated, in the call time's last 15 minutes: the minutes left and Add time. */
  callEnding?: { minutes: number; onAddTime: () => void } | undefined;
}

/** During a break (#56, decision 0300): until when tables are closed to the member, as long as it lasts. */
function BreakBanner() {
  const breakUntil = useRestrictions().data?.breakUntil ?? null;
  return breakUntil === null ? null : <Banner>{t('player.tonight.breakActive', { until: formatDateTime(new Date(breakUntil)) })}</Banner>;
}

/**
 * The banners at the top of Tonight (decision 0320), the only alerts inside the app: the club paused in red, a break, a refresh
 * that failed with Retry, the call time ending with Add time, offline, and the club's notices while browsing. Stacked
 * 8 px apart; nothing when there are none.
 */
export function TonightBanners({ notices, isBrowsing, shownAt, hasRefreshFailed, onRetry, callEnding }: TonightBannersProps) {
  const { isVenueFrozen } = useControlState();
  const isOnline = useIsOnline();
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set());
  const time = formatTime(new Date(shownAt));
  const shownNotices = isBrowsing ? notices.filter((notice) => !dismissed.has(notice.noticeId)) : [];
  return (
    <Stack gap={2}>
      {isVenueFrozen ? <Banner tone="alert">{t('player.alerts.paused')}</Banner> : null}
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
      {shownNotices.map((notice) => (
        <Banner key={notice.noticeId} onDismiss={() => setDismissed(new Set(dismissed).add(notice.noticeId))}>{notice.body}</Banner>
      ))}
    </Stack>
  );
}
