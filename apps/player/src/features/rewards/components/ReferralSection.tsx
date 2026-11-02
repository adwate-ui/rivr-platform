import { attributionSearch } from '@rivr/contracts/attribution';
import { useFeature } from '@rivr/db';
import { useMyReferral, type MyReferral } from '@rivr/db/myRewards';
import { formatChips, t } from '@rivr/i18n';
import { Box, Button, FeatureGate, Figure, Grid, Inline, LoadState, Stack, Text, useToast } from '@rivr/ui';

/** The offer in a line: the bonus each, when the club has set it. */
function offerOf({ bonus }: MyReferral): string {
  return bonus === null ? t('memberRewards.referral.how') : t('memberRewards.referral.offer', { chips: formatChips(bonus) });
}

/**
 * Copy link, and Share invite through the phone's own share sheet (the Web Share API), or the link copied where it has
 * none. A toast says the link was copied.
 */
function Invite({ link }: { link: string }) {
  const toast = useToast();
  const copy = async () => {
    await navigator.clipboard.writeText(link).then(() => toast(t('memberRewards.referral.linkCopied')), () => toast(t('memberRewards.referral.copyFailed')));
  };
  const share = async () => {
    if (typeof navigator.share !== 'function') return copy();
    await navigator.share({ text: t('memberRewards.referral.card.message'), url: link }).catch(() => undefined);
  };
  return (
    <Grid columns={2} gap={2}>
      <Button variant="outline" fullWidth onClick={() => void copy()}>{t('memberRewards.referral.copyLink')}</Button>
      <Button variant="primary" fullWidth onClick={() => void share()}>{t('memberRewards.referral.shareInvite')}</Button>
    </Grid>
  );
}

/** The member's card: Refer a friend, the offer, their code large with how many joined, then the two ways to invite. */
function Referral() {
  const referral = useMyReferral();
  if (referral.data === undefined) return <LoadState isError={referral.isError} onRetry={() => void referral.refetch()} />;
  if (referral.data === null) return null;
  // A friend's sign-up keeps the code from the link they opened (sign_up_attribution).
  const link = `${window.location.origin}/?${attributionSearch({ referral: referral.data.code })}`;
  return (
    <Box padding={5} hairline="all" radius="lg">
      <Stack gap={4}>
        <Text variant="eyebrow" tone="accent">{t('memberRewards.referral.title')}</Text>
        <Text>{offerOf(referral.data)}</Text>
        <Box surface="raised" paddingX={4} paddingY={3} radius="md">
          <Inline justify="between" align="center">
            <Figure size="stat">{referral.data.code}</Figure>
            <Text variant="small" tone="muted">{t('memberRewards.referral.joined', { count: referral.data.referred })}</Text>
          </Inline>
        </Box>
        <Invite link={link} />
      </Stack>
    </Box>
  );
}

/** Refer a friend (brief 3.8), with feature referral.share_cards. */
export function ReferralSection() {
  const shareCards = useFeature('referral.share_cards');
  return <FeatureGate access={shareCards}><Referral /></FeatureGate>;
}
