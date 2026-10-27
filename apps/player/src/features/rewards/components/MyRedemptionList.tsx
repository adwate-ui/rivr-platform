import { useMyRedemptions, type MyRedemption } from '@rivr/db/myRewards';
import { formatDayMonth, t } from '@rivr/i18n';
import { Button, Heading, Inline, Stack, Text } from '@rivr/ui';
import { priceText } from './Catalogue.tsx';

function RedemptionRow({ redemption }: { redemption: MyRedemption }) {
  const status = redemption.handedOverAt === null
    ? t('memberRewards.waiting', { detail: redemption.detail })
    : t('memberRewards.collected', { date: formatDayMonth(new Date(redemption.handedOverAt)) });
  return (
    <Stack gap={1}>
      <Text>{t('memberRewards.redemptionLine', { name: redemption.rewardName, price: priceText(redemption) })}</Text>
      <Text variant="small" tone={redemption.handedOverAt === null ? 'money' : 'muted'}>{status}</Text>
    </Stack>
  );
}

/** The member's redemptions, newest first: where to collect those still waiting, and when the rest were handed over. */
export function MyRedemptionList() {
  const redemptions = useMyRedemptions();
  const heading = <Heading level={2}>{t('memberRewards.yourRedemptions')}</Heading>;
  if (redemptions.data === undefined) {
    return (
      <Stack gap={3}>
        {heading}
        <Text tone="muted">{t(redemptions.isError ? 'common.loadFailed' : 'common.loading')}</Text>
        {redemptions.isError ? <Inline><Button onClick={() => void redemptions.refetch()}>{t('common.retry')}</Button></Inline> : null}
      </Stack>
    );
  }
  return (
    <Stack gap={4}>
      {heading}
      {redemptions.data.length === 0 ? <Text tone="muted">{t('memberRewards.noRedemptions')}</Text> : (
        <Stack gap={3} divided>{redemptions.data.map((redemption) => <RedemptionRow key={redemption.id} redemption={redemption} />)}</Stack>
      )}
    </Stack>
  );
}
