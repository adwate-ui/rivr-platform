import { useKycImageUrl, type CageMember } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Grid, Heading, Inline, KycPhoto, Money, Stack, Text } from '@rivr/ui';
import { BuyInForm } from './BuyInForm.tsx';

/** The chosen member, as in the prototype: KYC photo, name, tier, KYC and seat; wallet cash, bonus and markers; the buy-in. */
export function MemberPanel({ venueId, member }: { venueId: string; member: CageMember }) {
  const photo = useKycImageUrl(member.photoPath);
  const seat = member.seat === null ? t('console.cage.notSeated') : t('console.cage.seatLine', { table: member.seat.tableName, seat: member.seat.number });
  const status = [member.tierName, member.isKycComplete ? t('console.cage.kycVerified') : t('console.cage.kycIncomplete'), seat].join(' · ');
  const balances = [
    { label: t('console.cage.wallet'), paise: member.wallet },
    { label: t('console.cage.bonus'), paise: member.bonus },
    { label: t('console.cage.markers'), paise: member.markers },
  ];
  return (
    <Stack gap={6}>
      <Inline gap={4} align="center">
        <KycPhoto alt={t('console.cage.photoOf', { name: member.fullName })} src={photo.data ?? null}
          status={member.photoPath === null ? 'missing' : photo.isError ? 'error' : photo.data ? 'ready' : 'loading'} />
        <Stack gap={1}>
          <Heading level={2}>{member.fullName}</Heading>
          <Text variant="small" tone="muted">{status}</Text>
        </Stack>
      </Inline>
      <Grid columns={3} gap={4}>
        {balances.map((balance) => (
          <Stack key={balance.label} gap={1}>
            <Text variant="small" tone="muted">{balance.label}</Text>
            <Money paise={balance.paise} />
          </Stack>
        ))}
      </Grid>
      <BuyInForm venueId={venueId} member={member} />
    </Stack>
  );
}
