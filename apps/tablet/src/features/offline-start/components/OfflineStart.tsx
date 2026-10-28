import { t } from '@rivr/i18n';
import { Button, Screen, Stack, TabletShell, Text } from '@rivr/ui';
import { useCallback, useEffect, useState } from 'react';

const RETRY_EVERY_MS = 5_000;

/** Whether the hosted bundle answers. Any answer will do; only a network failure throws. */
async function canReach(url: string): Promise<boolean> {
  try {
    await fetch(url, { mode: 'no-cors', cache: 'no-store' });
    return true;
  } catch {
    return false;
  }
}

function openPage(url: string): void {
  window.location.replace(url);
}

/**
 * What the APK shows when the hosted bundle cannot load at start (#292), such as a tablet switched on before the club
 * Wi-Fi or the internet is up. It says the tablet is waiting for the network and tries again every five seconds, or at
 * once with Retry. It then opens RIVR Dealer without a touch, so a tablet in kiosk mode needs no restart.
 */
export function OfflineStart({ shellUrl, reach = canReach, open = openPage }: {
  shellUrl: string;
  /** For tests: whether the bundle answers, and how it is opened. */
  reach?: (url: string) => Promise<boolean>;
  open?: (url: string) => void;
}) {
  const [isTrying, setTrying] = useState(false);
  const tryNow = useCallback(async () => {
    setTrying(true);
    if (await reach(shellUrl)) open(shellUrl);
    else setTrying(false);
  }, [shellUrl, reach, open]);
  useEffect(() => {
    const timer = setInterval(() => void tryNow(), RETRY_EVERY_MS);
    return () => clearInterval(timer);
  }, [tryNow]);
  return (
    <TabletShell tableName={t('tablet.title')}>
      <Screen title={t('tablet.offlineStart.title')}>
        <Stack gap={6}>
          <Text>{t('tablet.offlineStart.body')}</Text>
          <Button variant="primary" isLoading={isTrying} onClick={() => void tryNow()}>{t('tablet.offlineStart.retry')}</Button>
        </Stack>
      </Screen>
    </TabletShell>
  );
}
