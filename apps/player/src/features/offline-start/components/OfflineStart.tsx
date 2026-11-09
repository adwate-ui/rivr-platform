import { t } from '@rivr/i18n';
import { Button, Screen, Stack, Text } from '@rivr/ui';
import { useCallback, useEffect, useState } from 'react';

const RETRY_EVERY_MS = 5_000;

/** Whether the hosted app answers. Any answer will do; only a network failure throws. */
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
 * What the store app shows when the hosted app cannot load at start (decision 0577). It says so and tries again every five
 * seconds, or at once with Retry, then opens the app without a touch.
 */
export function OfflineStart({ shellUrl, reach = canReach, open = openPage }: {
  shellUrl: string;
  /** For tests: whether the app answers, and how it is opened. */
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
    <Screen title={t('player.profile.offlineStart.title')}>
      <Stack gap={6}>
        <Text>{t('player.profile.offlineStart.body')}</Text>
        <Button variant="primary" isLoading={isTrying} onClick={() => void tryNow()}>{t('player.profile.offlineStart.retry')}</Button>
      </Stack>
    </Screen>
  );
}
