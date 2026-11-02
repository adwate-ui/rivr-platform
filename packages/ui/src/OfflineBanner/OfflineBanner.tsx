import { t } from '@rivr/i18n';
import { useSyncExternalStore } from 'react';
import { Text } from '../Text/Text.tsx';

function subscribeToConnection(onChange: () => void): () => void {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

export interface OfflineBannerProps {
  /** What it says while offline; the player app's line by default. */
  message?: string | undefined;
  /** What it says while online; nothing shows online without it. The dealer tablet's "Sending 2 hands." */
  onlineMessage?: string | undefined;
}

/** Whether the device is online now, kept in step with the browser's online and offline events. */
export function useIsOnline(): boolean {
  return useSyncExternalStore(subscribeToConnection, () => navigator.onLine, () => true);
}

/**
 * The slim banner shown while the device is offline: on the player app, that the installed app
 * still opens from its cached shell and may be out of date; on the dealer tablet, how many hands it
 * holds ("Offline. 3 hands queued."), and while online, that it is sending them. Nothing otherwise.
 */
export function OfflineBanner({ message, onlineMessage }: OfflineBannerProps = {}) {
  const online = useIsOnline();
  const text = online ? onlineMessage : (message ?? t('ui.offlineBanner'));
  // The status region is there all along, empty and taking no room while there is nothing to say, so a screen reader
  // announces the words when they come rather than meet a region that arrived with them (F5-09).
  return (
    <div role="status" className={text === undefined ? undefined : 'flex items-center bg-raised px-4 py-2 text-content'}>
      {text === undefined ? null : <Text as="span" variant="small" weight="medium">{text}</Text>}
    </div>
  );
}
