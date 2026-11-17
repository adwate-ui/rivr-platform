import { t } from '@rivr/i18n';
import { Banner } from '@rivr/ui';
import { useSyncExternalStore } from 'react';
import { hasWaitingUpdate, subscribeToWaitingUpdate, takeWaitingUpdate } from '../update.ts';

/** Whether a new version of the app is waiting for its moment (#1053). */
export function useIsNewVersionWaiting(): boolean {
  return useSyncExternalStore(subscribeToWaitingUpdate, hasWaitingUpdate, () => false);
}

/**
 * A new version of the app is waiting for its moment (#1053): the member can take it now with Refresh. On every tab's
 * screen and both sign-in steps; not on sign-up or the ID check, where a reload would lose what was typed, and which take
 * it at the next screen.
 */
export function NewVersionBanner() {
  if (!useIsNewVersionWaiting()) return null;
  return <Banner action={{ label: t('player.alerts.refresh'), onPress: takeWaitingUpdate }}>{t('player.alerts.newVersion')}</Banner>;
}
