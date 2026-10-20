import { useMembershipCard } from '@rivr/db';
import { t } from '@rivr/i18n';
import { MembershipCard, Screen, Stack, Text } from '@rivr/ui';
import { QrCode } from '@rivr/ui/qr-code';

/**
 * The digital membership card (#71; tech plan item 28), core and never gated: the member's name, tier and
 * number, and the QR the door scans. The QR changes every few seconds (card.qr_rotation_seconds) and the
 * app fetches the new one as it changes, so a screenshot of an old one does not check in (decision 0162).
 */
export function CardScreen() {
  const card = useMembershipCard();
  const title = t('player.card.title');
  if (card.isPending) return <Screen title={title} status="loading" />;
  if (card.isError || card.data === null) return <Screen title={title} status="error" onRetry={() => void card.refetch()} />;
  const { fullName, tierName, memberNumber, code } = card.data;
  return (
    <Screen title={title}>
      <Stack gap={4} align="center">
        <MembershipCard name={fullName} tier={tierName} memberNumber={memberNumber} qr={<QrCode value={code} label={t('player.card.qr')} />} />
        <Text tone="muted" align="center">{t('player.card.hint')}</Text>
      </Stack>
    </Screen>
  );
}
