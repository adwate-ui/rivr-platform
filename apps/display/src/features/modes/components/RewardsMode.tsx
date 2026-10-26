import { useTvRewardsTicker, type TvRewardsTicker } from '@rivr/db';
import { formatNumber, t } from '@rivr/i18n';
import { Text, TvWaitlistBoard, type TvWaitlistStake } from '@rivr/ui';

/** The ticker as the board's two columns: the points leaders by place, and the week's redemptions, newest first. */
export function toRewardsColumns(ticker: TvRewardsTicker): TvWaitlistStake[] {
  return [
    {
      id: 'leaders', stake: t('tv.rewards.leaders'), detail: t('tv.rewards.leadersDetail'),
      places: ticker.leaders.map((leader, index) => ({
        id: `leader-${index}`, place: String(leader.place), name: leader.name ?? t('tv.rewards.hiddenName'),
        status: t('tv.rewards.points', { points: formatNumber(leader.points) }),
      })),
    },
    {
      id: 'redeemed', stake: t('tv.rewards.redeemed'), detail: t('tv.rewards.redeemedDetail'),
      places: ticker.redemptions.map((redemption, index) => ({
        // Newest first; the board's narrow place column has no room for a time, so it stays empty.
        id: `redemption-${index}`, place: '', name: redemption.name ?? t('tv.rewards.hiddenName'),
        status: redemption.rewardName,
      })),
    },
  ];
}

/** The rewards ticker (#148, decision 0183): this month's points leaders beside the week's redemptions, live as members redeem. */
export function RewardsMode() {
  const ticker = useTvRewardsTicker();
  if (ticker.data === undefined) {
    return <Text variant="tvBody" tone="muted">{t(ticker.isError ? 'display.screen.unavailable' : 'common.loading')}</Text>;
  }
  return <TvWaitlistBoard title={t('tv.rewards.title')} emptyText={t('tv.rewards.empty')} stakes={toRewardsColumns(ticker.data)} />;
}
