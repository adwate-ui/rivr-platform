import { useMyReferral } from '@rivr/db/myRewards';
import { t } from '@rivr/i18n';
import { Heading, LoadState, Stack, Text } from '@rivr/ui';

/** Refer a friend (#151): the member's code, what a referral gives once the friend first buys in, and how many so far. */
export function ReferralSection() {
  const referral = useMyReferral();
  if (referral.data === undefined) return <LoadState isError={referral.isError} onRetry={() => void referral.refetch()} />;
  if (referral.data === null) return null;
  return (
    <Stack gap={2}>
      <Heading level={2}>{t('memberRewards.referral.title')}</Heading>
      <Text>{t('memberRewards.referral.how')}</Text>
      <Text variant="lead" isTabular>{referral.data.code}</Text>
      <Text variant="small" tone="muted">
        {referral.data.referred === 1 ? t('memberRewards.referral.referredOne') : t('memberRewards.referral.referred', { count: referral.data.referred })}
      </Text>
    </Stack>
  );
}
