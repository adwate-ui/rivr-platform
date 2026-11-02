import { useKycImageUrl, useMembershipCard } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Box, Inline, KycPhoto, kycPhotoStatus, MembershipCard, Screen, Stack } from '@rivr/ui';
import { QrCode } from '@rivr/ui/qr-code';
import { useEffect } from 'react';

/** The member's verified selfie on the card (decision 0300), through the kyc-image-url function. */
function CardPhoto({ path }: { path: string }) {
  const photo = useKycImageUrl(path);
  return <KycPhoto isFilling alt={t('player.card.photo')} src={photo.data ?? null} status={kycPhotoStatus(path, photo)} />;
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

/**
 * The Card tab (decision 0320; #71): the membership card, gold-edged, with the member's number, verified selfie, name and
 * tier, then the QR the door scans on its cream panel. No caption. Offline before the card came, it says to give the number.
 */
export function CardScreen() {
  const card = useMembershipCard();
  useScreenAwake();
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
        <Inline justify="center">
          <Box surface="cream" padding={4} radius="card"><QrCode value={code} label={t('player.card.qr')} /></Box>
        </Inline>
      </Stack>
    </Screen>
  );
}
