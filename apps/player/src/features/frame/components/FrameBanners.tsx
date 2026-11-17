import { t } from '@rivr/i18n';
import { Banner, Stack, useIsOnline } from '@rivr/ui';
import { NewVersionBanner, useIsNewVersionWaiting } from './NewVersionBanner.tsx';

/**
 * At the top of every screen but Tonight, which has its own banners (decision 0320): a new version waiting (#1053), and
 * the phone offline. Nothing, taking no room, when there is neither.
 */
export function FrameBanners() {
  const isOnline = useIsOnline();
  const isNewVersionWaiting = useIsNewVersionWaiting();
  if (isOnline && !isNewVersionWaiting) return null;
  return (
    <Stack gap={2}>
      <NewVersionBanner />
      {isOnline ? null : <Banner>{t('player.alerts.offlineScreen')}</Banner>}
    </Stack>
  );
}
