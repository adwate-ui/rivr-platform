import { t } from '@rivr/i18n';
import { Banner, useIsOnline } from '@rivr/ui';

/** The phone offline, at the top of every screen but Tonight, which has its own banners (decision 0320). */
export function FrameBanners() {
  const isOnline = useIsOnline();
  return isOnline ? null : <Banner>{t('player.alerts.offlineScreen')}</Banner>;
}
