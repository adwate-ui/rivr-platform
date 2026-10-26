import { useFeature } from '@rivr/db';
import { useMyRewards } from '@rivr/db/myRewards';
import { memberRewards, registerMessages, t } from '@rivr/i18n';
import { FeatureGate, Number, Screen, Stack, Text } from '@rivr/ui';
import { Catalogue } from './Catalogue.tsx';
import { LeagueSection } from './LeagueSection.tsx';
import { MyRedemptionList } from './MyRedemptionList.tsx';

// The tab's copy loads with the tab, so the app's first load carries none of it (#344).
registerMessages({ memberRewards });

/**
 * Rewards (#152; design prompt "Rewards"): the member's points and tier, always; then the catalogue and
 * their redemptions (rewards.catalogue) and the RIVR League (league.standings), each behind its feature.
 * Referral (#151) and cab requests (#140) join it when they are built.
 */
export function RewardsScreen() {
  const rewards = useMyRewards();
  const catalogue = useFeature('rewards.catalogue');
  const league = useFeature('league.standings');
  const title = t('memberRewards.title');
  if (rewards.isPending) return <Screen title={title} status="loading" />;
  if (rewards.data === undefined) return <Screen title={title} status="error" onRetry={() => void rewards.refetch()} />;
  if (rewards.data === null) return <Screen title={title} status="empty" emptyText={t('memberRewards.notMember')} />;
  return (
    <Screen title={title}>
      <Stack gap={10}>
        <Stack gap={2}>
          <Text variant="small" tone="muted">{t('memberRewards.points')}</Text>
          <Number value={rewards.data.points} size="title" />
          <Text tone="muted">{t('memberRewards.tier', { tier: rewards.data.tierName })}</Text>
        </Stack>
        <FeatureGate access={catalogue}>
          <Stack gap={10}>
            <Catalogue />
            <MyRedemptionList />
          </Stack>
        </FeatureGate>
        <FeatureGate access={league}><LeagueSection /></FeatureGate>
      </Stack>
    </Screen>
  );
}
