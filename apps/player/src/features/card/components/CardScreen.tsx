import { useKycImageUrl, useMembershipCard } from '@rivr/db';
import { t } from '@rivr/i18n';
import { KycPhoto, kycPhotoStatus, MembershipCard, Screen, Stack, Text } from '@rivr/ui';
import { QrCode } from '@rivr/ui/qr-code';

/** The member's verified selfie on their card, fetched as every KYC image is: a one-minute signed link (decision 0300). */
function CardPhoto({ path }: { path: string }) {
  const photo = useKycImageUrl(path);
  return <KycPhoto isFilling alt={t('player.card.photo')} src={photo.data ?? null} status={kycPhotoStatus(path, photo)} />;
}

/**
 * The digital membership card (#71; tech plan item 28), core and never gated: the member's name, tier and
 * number, their verified selfie, and the QR the door scans. The QR changes every few seconds (card.qr_rotation_seconds) and the
 * app fetches the new one as it changes, so a screenshot of an old one does not check in (decision 0162).
 * With no connection it says to give the number at the door (F3-25): a code it already has goes stale in seconds, and
 * the door refuses it. The browser's own reading counts, as an app opened offline has not yet paused its reads.
 */
export function CardScreen() {
  const card = useMembershipCard();
  const title = t('player.card.title');
  if (!navigator.onLine || card.fetchStatus === 'paused') {
    return <Screen title={title} status="error" errorText={t('player.card.offline')} onRetry={() => void card.refetch()} />;
  }
  if (card.isPending) return <Screen title={title} status="loading" />;
  if (card.isError || card.data === null) return <Screen title={title} status="error" onRetry={() => void card.refetch()} />;
  const { fullName, tierName, memberNumber, code, photoPath } = card.data;
  return (
    <Screen title={title}>
      <Stack gap={4} align="center">
        <MembershipCard name={fullName} tier={tierName} memberNumber={memberNumber} qr={<QrCode value={code} label={t('player.card.qr')} />}
          photo={photoPath === null ? undefined : <CardPhoto path={photoPath} />} />
        <Text tone="muted" align="center">{t('player.card.hint')}</Text>
      </Stack>
    </Screen>
  );
}
