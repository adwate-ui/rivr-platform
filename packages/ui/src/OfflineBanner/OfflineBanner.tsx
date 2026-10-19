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

/**
 * The slim banner shown while the device is offline: on the player app, that the installed app
 * still opens from its cached shell and may be out of date; on the dealer tablet, how many hands it
 * holds ("Offline. 3 hands queued."), and while online, that it is sending them. Nothing otherwise.
 */
export function OfflineBanner({ message, onlineMessage }: OfflineBannerProps = {}) {
  const online = useSyncExternalStore(subscribeToConnection, () => navigator.onLine, () => true);
  const text = online ? onlineMessage : (message ?? t('ui.offlineBanner'));
  if (text === undefined) return null;
  return (
    <div role="status" className="flex items-center bg-raised px-4 py-2 text-content">
      <Text as="span" variant="small" weight="medium">
        {text}
      </Text>
    </div>
  );
}
