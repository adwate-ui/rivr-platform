import { REWARD_KINDS, type RewardKind } from '@rivr/contracts/rewardKinds';
import type { RewardItem } from '@rivr/db';
import { useRedeemReward, useRewardCatalogue } from '@rivr/db/myRewards';
import { formatNumber, t } from '@rivr/i18n';
import { Box, Button, ChoiceChips, DetailRow, ErrorMessage, Inline, ItemPhoto, LoadState, Skeleton, Sheet, Stack, Text, useToast } from '@rivr/ui';
import { useState } from 'react';

/** A reward's price: points, or hotel nights. */
export function priceText({ points, nights }: { points: bigint | null; nights: number | null }): string {
  if (nights !== null) return nights === 1 ? t('memberRewards.oneNight') : t('memberRewards.nightsPrice', { nights: formatNumber(nights) });
  return points === 1n ? t('memberRewards.onePoint') : t('memberRewards.price', { points: formatNumber(points ?? 0n) });
}

/** Where and how it is collected, with how many are left where the club counts them. */
const noteOf = (item: RewardItem) => (item.stock === null ? item.detail : t('memberRewards.leftLine', { count: formatNumber(item.stock), detail: item.detail }));

/** Whether the member's points cover a reward priced in points; a hotel night's own check is the database's. */
const canAfford = (item: RewardItem, balance: bigint) => item.points === null || balance >= item.points;

/**
 * The redeem sheet (brief 3.8): Redeem, the reward, its cost and the balance after, how it is collected, then Redeem or
 * Cancel. One request id until the server answers, so a retried tap redeems once; done, a toast says so.
 */
function RedeemSheet({ item, balance, onClose }: { item: RewardItem; balance: bigint; onClose: () => void }) {
  const redeem = useRedeemReward();
  const toast = useToast();
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [failure, setFailure] = useState<string | null>(null);
  const press = async () => {
    const done = await redeem.mutateAsync({ itemId: item.id, points: item.points, nights: item.nights, requestId });
    if (done.ok || done.error !== 'unavailable') setRequestId(crypto.randomUUID());
    setFailure(done.ok ? null : t(`memberRewards.failures.${done.error}`));
    if (!done.ok) return;
    toast(t('memberRewards.redeemedToast'));
    onClose();
  };
  return (
    <Sheet isOpen onClose={onClose} eyebrow={t('memberRewards.redeem')} title={item.name}>
      <Box>
        <DetailRow label={t('memberRewards.cost')} labelTone="muted" value={priceText(item)} />
        {item.points === null ? null : (
          <DetailRow label={t('memberRewards.balanceAfter')} labelTone="muted" isLast value={t('memberRewards.price', { points: formatNumber(balance - item.points) })} />
        )}
      </Box>
      <Text variant="small" tone="muted">{noteOf(item)}</Text>
      <Stack gap={3}>
        <Button variant="primary" size="tall" fullWidth isLoading={redeem.isPending} onClick={() => void press()}>{t('memberRewards.redeem')}</Button>
        {failure === null ? null : <ErrorMessage look="dot">{failure}</ErrorMessage>}
        <Button variant="text" fullWidth onClick={onClose}>{t('memberRewards.cancel')}</Button>
      </Stack>
    </Sheet>
  );
}

/** One reward: its tile, name, cost in gold and note; Redeem, or how many points short, or none left. */
function RewardRow({ item, balance, onRedeem }: { item: RewardItem; balance: bigint; onRedeem: () => void }) {
  const isShort = !canAfford(item, balance);
  const cta = item.stock === 0 ? t('memberRewards.noneLeft')
    : isShort ? t('memberRewards.toGo', { points: formatNumber((item.points ?? 0n) - balance) }) : t('memberRewards.redeem');
  return (
    <Inline gap={3} align="center">
      <ItemPhoto src={item.photoUrl} name={item.name} size="sm" />
      <Stack gap={1} grow>
        <Text weight="medium">{item.name}</Text>
        <Text variant="small" tone="accent">{priceText(item)}</Text>
        <Text variant="caption" tone="muted">{noteOf(item)}</Text>
      </Stack>
      <Button variant="outline" shape="pill" isDisabled={isShort || item.stock === 0} aria-label={t('memberRewards.redeemName', { name: item.name })}
        onClick={onRedeem}>{cta}</Button>
    </Inline>
  );
}

/**
 * The catalogue (brief 3.8): filter pills that scroll (All and each kind), a row a reward, and the redeem sheet. Feature
 * rewards.catalogue, gated by the screen.
 */
export function Catalogue({ balance }: { balance: bigint }) {
  const catalogue = useRewardCatalogue();
  const [kind, setKind] = useState<RewardKind | 'all'>('all');
  const [redeeming, setRedeeming] = useState<RewardItem | null>(null);
  const options = [{ value: 'all' as const, label: t('memberRewards.all') }, ...REWARD_KINDS.map((value) => ({ value, label: t(`memberRewards.kinds.${value}`) }))];
  // A skeleton while it comes, never the word Loading (brief 2.6); Try again if it cannot.
  if (catalogue.isError) return <LoadState isError onRetry={() => void catalogue.refetch()} />;
  if (catalogue.data === undefined) return <Skeleton rows={2} />;
  const shown = catalogue.data.filter((item) => kind === 'all' || item.kind === kind);
  return (
    <Stack gap={4}>
      <ChoiceChips label={t('memberRewards.show')} isLabelVisuallyHidden look="pill" mode="one" isOneRow selected={[kind]} options={options}
        onChange={(chosen) => setKind(chosen[0] ?? 'all')} />
      {shown.length === 0 ? <Text tone="muted">{t('memberRewards.noRewards')}</Text> : (
        <Stack gap={3} divided>{shown.map((item) => <RewardRow key={item.id} item={item} balance={balance} onRedeem={() => setRedeeming(item)} />)}</Stack>
      )}
      {redeeming === null ? null : <RedeemSheet item={redeeming} balance={balance} onClose={() => setRedeeming(null)} />}
    </Stack>
  );
}
