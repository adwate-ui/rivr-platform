import { useFeature, useMyLockedPoints } from '@rivr/db';
import { useMyRewards, useRewardCatalogue, type MyRewards } from '@rivr/db/myRewards';
import { nextReward } from '@rivr/domain/rewards';
import { formatNights, formatNumber, memberRewards, registerMessages, t } from '@rivr/i18n';
import { FeatureGate, Figure, Inline, ProgressBar, Screen, Stack, Text } from '@rivr/ui';
import { BonusSection } from './BonusSection.tsx';
import { Catalogue } from './Catalogue.tsx';
import { LeagueSection } from './LeagueSection.tsx';
import { MyRedemptionList } from './MyRedemptionList.tsx';
import { ReferralSection } from './ReferralSection.tsx';

// The tab's copy loads with the tab, so the app's first load carries none of it (#344).
registerMessages({ memberRewards });

/**
 * "Next: Sunday Main Event seat" with how many points short, over a bar of the share held (@rivr/domain nextReward), of the
 * rewards still to be had (one with none left is not next); with every reward in points within reach, "Everything
 * unlocked" over a full bar. Nothing while the catalogue has no reward in points.
 */
function NextReward({ points }: { points: bigint }) {
  const inStock = (useRewardCatalogue().data ?? []).filter((item) => item.stock !== 0);
  const next = nextReward(points, inStock);
  if (next === null && !inStock.some((item) => item.points !== null)) return null;
  return (
    <Stack gap={2}>
      <Inline justify="between" gap={3}>
        <Text variant="small">{next === null ? t('memberRewards.allUnlocked') : t('memberRewards.next', { name: next.item.name })}</Text>
        {next === null ? null : <Text variant="small" tone="muted">{t('memberRewards.toGo', { points: formatNumber(next.gap) })}</Text>}
      </Inline>
      <ProgressBar fraction={next === null ? 1 : next.fraction} />
    </Stack>
  );
}

/** The tier, the points in gold, locked points if any, and the way to the next reward. */
function Balance({ rewards, hasCatalogue }: { rewards: MyRewards; hasCatalogue: boolean }) {
  const locked = useMyLockedPoints().data;
  return (
    <Stack gap={2}>
      <Text variant="eyebrow" tone="accent">{rewards.tierName}</Text>
      <Inline gap={3} align="baseline">
        <Figure size="display" tone="money">{formatNumber(rewards.points)}</Figure>
        <Text tone="muted">{t('memberRewards.pointsWord')}</Text>
      </Inline>
      {locked === undefined || locked === 0n ? null : <Text tone="muted">{t('memberRewards.locked', { points: formatNumber(locked) })}</Text>}
      {hasCatalogue ? <NextReward points={rewards.points} /> : null}
    </Stack>
  );
}

/**
 * Rewards (decision 0320): the tier, the points and the next reward; bonus chips and their history (rewards.bonus, decision
 * 0504); the catalogue with its filters and redeem sheet (rewards.catalogue) and the member's redemptions; hotel nights
 * (rewards.accommodation); the league (league.standings); and Refer a friend.
 */
export function RewardsScreen() {
  const rewards = useMyRewards();
  const bonus = useFeature('rewards.bonus');
  const catalogue = useFeature('rewards.catalogue');
  const league = useFeature('league.standings');
  const accommodation = useFeature('rewards.accommodation');
  const title = t('memberRewards.title');
  const look = { titleLook: 'serif' } as const;
  if (rewards.isPending) return <Screen {...look} title={title} status="loading" loadingLook="skeleton" />;
  if (rewards.data === undefined) return <Screen {...look} title={title} status="error" onRetry={() => void rewards.refetch()} />;
  if (rewards.data === null) return <Screen {...look} title={title} status="empty" emptyText={t('memberRewards.notMember')} />;
  return (
    <Screen {...look} title={title}>
      <Stack gap={8}>
        <Balance rewards={rewards.data} hasCatalogue={catalogue.state === 'enabled'} />
        <FeatureGate access={bonus}><BonusSection /></FeatureGate>
        <FeatureGate access={accommodation}>
          <Stack gap={1}>
            <Text variant="small" tone="muted">{t('memberRewards.nights')}</Text>
            <Text variant="lead" isTabular>{formatNights(rewards.data.nights)}</Text>
          </Stack>
        </FeatureGate>
        <FeatureGate access={catalogue}>
          <Stack gap={8}>
            <Catalogue balance={rewards.data.points} />
            <MyRedemptionList />
          </Stack>
        </FeatureGate>
        <FeatureGate access={league}><LeagueSection /></FeatureGate>
        <ReferralSection />
      </Stack>
    </Screen>
  );
}
