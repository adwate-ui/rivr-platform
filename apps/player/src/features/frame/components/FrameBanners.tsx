import { useControlState } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Banner, Stack, useIsOnline } from '@rivr/ui';

/**
 * The club paused, in red, and the phone offline, at the top of every screen but Tonight, which has its own banners
 * (decision 0320): a paused club is never hidden (.claude/rules/apps.md).
 */
export function FrameBanners() {
  const { isVenueFrozen } = useControlState();
  const isOnline = useIsOnline();
  if (!isVenueFrozen && isOnline) return null;
  return (
    <Stack gap={2}>
      {isVenueFrozen ? <Banner tone="alert">{t('player.alerts.paused')}</Banner> : null}
      {isOnline ? null : <Banner>{t('player.alerts.offlineScreen')}</Banner>}
    </Stack>
  );
}
