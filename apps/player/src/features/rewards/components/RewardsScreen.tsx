import { useFeature, useMyLockedPoints } from '@rivr/db';
import { useMyRewards, useRewardCatalogue, type MyRewards } from '@rivr/db/myRewards';
import { nextReward } from '@rivr/domain/rewards';
import { formatNights, formatNumber, memberRewards, registerMessages, t } from '@rivr/i18n';
import { useMyBonus } from '@rivr/db/bonus';
import { BalanceTile, FeatureGate, Grid, Inline, LoadState, ProgressBar, Screen, Stack, Text, type FeatureAccess } from '@rivr/ui';
import { useState } from 'react';
import { BonusHistory, BonusTile } from './BonusSection.tsx';
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

/**
 * The tier, then points and bonus chips side by side, each with its one line (owner, 8 Nov: told apart at a glance); locked
 * points if any, the way to the next reward, and the bonus chips history once its tile opens it.
 */
/** Points the club gave locked (#645), under the tiles: nothing when there are none. */
function LockedPoints() {
  const locked = useMyLockedPoints().data;
  if (locked === undefined || locked === 0n) return null;
  return <Text tone="muted">{t('memberRewards.locked', { points: formatNumber(locked) })}</Text>;
}

/**
 * The bonus chips tile, its Try again and its history, as Rewards places them. With the feature off, or the chips not
 * read, there is no tile, and points take the whole row.
 */
function useChips(bonus: FeatureAccess) {
  const chips = useMyBonus();
  const [isOpen, setOpen] = useState(false);
  const isOn = bonus.state === 'enabled';
  const hasTile = isOn && !chips.isError && chips.data !== null;
  return {
    hasTile,
    tile: hasTile ? <BonusTile chips={chips.data ?? undefined} isOpen={isOpen} onToggle={() => setOpen(!isOpen)} /> : null,
    retry: isOn && chips.isError ? <LoadState isError onRetry={() => void chips.refetch()} /> : null,
    history: hasTile && isOpen ? <BonusHistory /> : null,
  };
}

function Balances({ rewards, hasCatalogue, bonus }: { rewards: MyRewards; hasCatalogue: boolean; bonus: FeatureAccess }) {
  const chips = useChips(bonus);
  return (
    <Stack gap={3}>
      <Text variant="eyebrow" tone="accent">{rewards.tierName}</Text>
      <Grid columns={chips.hasTile ? 2 : 1} gap={3}>
        <BalanceTile icon="star" figure={formatNumber(rewards.points)} label={t('memberRewards.pointsLabel')} line={t('memberRewards.pointsLine')} />
        {chips.tile}
      </Grid>
      {chips.retry}
      {chips.history}
      <LockedPoints />
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
        <Balances rewards={rewards.data} hasCatalogue={catalogue.state === 'enabled'} bonus={bonus} />
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
