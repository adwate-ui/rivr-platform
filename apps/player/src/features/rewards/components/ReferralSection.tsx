import { useFeature } from '@rivr/db';
import { useMyReferral } from '@rivr/db/myRewards';
import { t } from '@rivr/i18n';
import { FeatureGate, Heading, LoadState, Stack, Text } from '@rivr/ui';
import { ShareReferralCard } from './ShareReferralCard.tsx';

/**
 * Refer a friend (#151): the member's code, what a referral gives once the friend first buys in, and how many so far;
 * then their share card (#153, referral.share_cards).
 */
export function ReferralSection() {
  const referral = useMyReferral();
  const shareCards = useFeature('referral.share_cards');
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
      <FeatureGate access={shareCards}><ShareReferralCard code={referral.data.code} /></FeatureGate>
    </Stack>
  );
}
