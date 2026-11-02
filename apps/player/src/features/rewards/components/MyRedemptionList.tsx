import { useMyRedemptions, type MyRedemption } from '@rivr/db/myRewards';
import { formatDayMonth, t } from '@rivr/i18n';
import { Box, DetailRow, Heading, LoadState, Stack } from '@rivr/ui';

/** Where a redemption stands: cancelled by staff with why (decision 0302), ready to collect, or collected and when. */
function statusOf(redemption: MyRedemption): { text: string; isReady: boolean } {
  if (redemption.cancelReason !== null) return { text: t('memberRewards.cancelled', { reason: redemption.cancelReason }), isReady: false };
  if (redemption.handedOverAt === null) return { text: t('memberRewards.readyToCollect'), isReady: true };
  return { text: t('memberRewards.collected', { date: formatDayMonth(new Date(redemption.handedOverAt)) }), isReady: false };
}

/**
 * "Your redemptions" (brief 3.8): each reward redeemed, Ready to collect in gold until it is handed over, then when it was
 * collected; one staff cancelled says so, with why. Nothing until there is one.
 */
export function MyRedemptionList() {
  const redemptions = useMyRedemptions();
  if (redemptions.data === undefined) return <LoadState isError={redemptions.isError} onRetry={() => void redemptions.refetch()} />;
  if (redemptions.data.length === 0) return null;
  return (
    <Stack gap={2}>
      <Heading level={2} variant="subsection">{t('memberRewards.yourRedemptions')}</Heading>
      <Box>
        {redemptions.data.map((redemption) => {
          const status = statusOf(redemption);
          return <DetailRow key={redemption.id} label={redemption.rewardName} valueTone={status.isReady ? 'accent' : 'muted'} value={status.text} />;
        })}
      </Box>
    </Stack>
  );
}
