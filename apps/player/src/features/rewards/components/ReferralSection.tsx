import { attributionSearch } from '@rivr/contracts/attribution';
import { useFeature } from '@rivr/db';
import { useMyReferral, type MyReferral } from '@rivr/db/myRewards';
import { formatChips, t } from '@rivr/i18n';
import { Button, ErrorMessage, FeatureGate, Heading, LoadState, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { ShareReferralCard } from './ShareReferralCard.tsx';

/**
 * Refer a friend (#151, #153; feature referral.share_cards): the member's code, what a referral gives each side while
 * the referral promotion runs, how many so far, their link to copy, and their share card.
 */
export function ReferralSection() {
  const shareCards = useFeature('referral.share_cards');
  return <FeatureGate access={shareCards}><Referral /></FeatureGate>;
}

function Referral() {
  const referral = useMyReferral();
  if (referral.data === undefined) return <LoadState isError={referral.isError} onRetry={() => void referral.refetch()} />;
  if (referral.data === null) return null;
  // A friend's sign-up keeps the code from the link they opened (sign_up_attribution).
  const link = `${window.location.origin}/?${attributionSearch({ referral: referral.data.code })}`;
  return (
    <Stack gap={2}>
      <Heading level={2}>{t('memberRewards.referral.title')}</Heading>
      <Text>{howItWorks(referral.data)}</Text>
      <Text variant="lead" isTabular>{referral.data.code}</Text>
      <Text variant="small" tone="muted">
        {referral.data.referred === 1 ? t('memberRewards.referral.referredOne') : t('memberRewards.referral.referred', { count: referral.data.referred })}
      </Text>
      <CopyLink link={link} />
      <ShareReferralCard code={referral.data.code} link={link} />
    </Stack>
  );
}

function howItWorks({ bonus }: MyReferral): string {
  return bonus === null ? t('memberRewards.referral.how') : t('memberRewards.referral.howAmount', { chips: formatChips(bonus) });
}

/** The member's referral link, copied to paste anywhere. */
function CopyLink({ link }: { link: string }) {
  const [copied, setCopied] = useState<'not yet' | 'copied' | 'failed'>('not yet');
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied('copied');
    } catch {
      setCopied('failed');
    }
  };
  return (
    <Stack gap={1}>
      <Button variant="secondary" onClick={() => void copy()}>
        {copied === 'copied' ? t('memberRewards.referral.copied') : t('memberRewards.referral.copy')}
      </Button>
      {copied === 'failed' ? <ErrorMessage>{t('memberRewards.referral.copyFailed')}</ErrorMessage> : null}
    </Stack>
  );
}
