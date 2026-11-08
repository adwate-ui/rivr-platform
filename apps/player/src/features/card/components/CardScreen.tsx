import { useKycImageUrl, useMember, useMembershipCard } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Box, KycPhoto, kycPhotoStatus, MembershipCard, ProgressBar, Screen, Stack, Text } from '@rivr/ui';
import { QrCode } from '@rivr/ui/qr-code';
import { useEffect, useState } from 'react';

/** The member's verified selfie on the card (decision 0300), through the kyc-image-url function; their initial until it shows. */
function CardPhoto({ path }: { path: string }) {
  const photo = useKycImageUrl(path);
  const initial = useMember().data?.initial;
  return <KycPhoto isFilling alt={t('player.card.photo')} src={photo.data ?? null} status={kycPhotoStatus(path, photo)} initial={initial} />;
}

/**
 * Keeps the screen on while the card shows, so the door's scanner reads it (decision 0320): the Screen Wake Lock API where
 * the phone has it, released as the card goes; silently nothing elsewhere. A web page cannot set the brightness.
 */
function useScreenAwake() {
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    let isGone = false;
    const wakeLock: unknown = Reflect.get(navigator, 'wakeLock');
    const request: unknown = typeof wakeLock === 'object' && wakeLock !== null ? Reflect.get(wakeLock, 'request') : undefined;
    if (typeof request !== 'function') return undefined;
    void Promise.resolve(Reflect.apply(request, wakeLock, ['screen'])).then((held: { release: () => Promise<void> }) => {
      if (isGone) void held.release();
      else lock = held;
    }, () => undefined);
    return () => {
      isGone = true;
      void lock?.release();
    };
  }, []);
}

/** How much of the door code's time is left since it came, 1 to 0, read again each second: the bar under the QR (F-182). */
function useCodeLeft(cameAt: number, msLeft: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);
  return msLeft > 0 ? Math.max(0, cameAt + msLeft - now) / msLeft : 0;
}

const BRIGHTNESS_HINTED = 'rivr.card.brightnessHinted';

/** Whether this is the session's first look at the card, when the brightness hint shows; never, where storage is refused. */
function useFirstLookThisSession(): boolean {
  const [isFirst] = useState(() => {
    try {
      return sessionStorage.getItem(BRIGHTNESS_HINTED) === null;
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      sessionStorage.setItem(BRIGHTNESS_HINTED, '1');
    } catch {
      // A private window: the hint simply does not show again.
    }
  }, []);
  return isFirst;
}

/**
 * The Card tab (decision 0320; #71): the membership card, gold-edged, with the member's number, verified selfie, name and
 * tier, then the QR the door scans on its cream panel across the card's column, a gold bar under it running down to the
 * next code so the desk sees it is live, and once a session a hint to turn the brightness up (F-182). No caption.
 * Offline before the card came, it says to give the number.
 */
export function CardScreen() {
  const card = useMembershipCard();
  useScreenAwake();
  const codeLeft = useCodeLeft(card.dataUpdatedAt, card.data?.msLeft ?? 0);
  const isHinted = useFirstLookThisSession();
  const title = t('player.card.tab');
  const look = { titleLook: 'serif' } as const;
  if (!navigator.onLine || card.fetchStatus === 'paused') {
    return <Screen {...look} title={title} status="error" errorText={t('player.card.offline')} onRetry={() => void card.refetch()} />;
  }
  if (card.isPending) return <Screen {...look} title={title} status="loading" loadingLook="skeleton" />;
  if (card.isError || card.data === null) return <Screen {...look} title={title} status="error" onRetry={() => void card.refetch()} />;
  const { fullName, tierName, memberNumber, code, photoPath } = card.data;
  return (
    <Screen {...look} title={title}>
      <Stack gap={6}>
        <MembershipCard look="redesign" name={fullName} tier={tierName} memberNumber={memberNumber}
          photo={photoPath === null ? undefined : <CardPhoto path={photoPath} />} />
        <Stack gap={3}>
          <Box surface="cream" padding={4} radius="card"><QrCode value={code} label={t('player.card.qr')} /></Box>
          <ProgressBar fraction={codeLeft} />
          {isHinted ? <Text variant="small" tone="muted" align="center">{t('player.card.brightness')}</Text> : null}
        </Stack>
      </Stack>
    </Screen>
  );
}
