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

/**
 * The slim banner the player app shows while the phone is offline: the installed app still opens
 * from its cached shell, and this says that what it shows may be out of date. Nothing while online.
 */
export function OfflineBanner() {
  const online = useSyncExternalStore(subscribeToConnection, () => navigator.onLine, () => true);
  if (online) return null;
  return (
    <div role="status" className="flex items-center bg-raised px-4 py-2 text-content">
      <Text as="span" variant="small" weight="medium">
        {t('ui.offlineBanner')}
      </Text>
    </div>
  );
}
