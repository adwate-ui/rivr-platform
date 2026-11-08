import { REWARD_KINDS, type RewardKind } from '@rivr/contracts/rewardKinds';
import type { RewardItem } from '@rivr/db';
import { useRedeemReward, useRewardCatalogue } from '@rivr/db/myRewards';
import { rewardShortfall, soldOutLast, type RewardShortfall, type RewardsHeld } from '@rivr/domain/rewards';
import { formatNights, formatNumber, t } from '@rivr/i18n';
import { Box, Button, ChoiceChips, DetailRow, ErrorMessage, Inline, ItemPhoto, LoadState, Skeleton, Sheet, Stack, Text, useToast } from '@rivr/ui';
import { useState } from 'react';

/** A reward's price: points, or hotel nights. */
export function priceText({ points, nights }: { points: bigint | null; nights: number | null }): string {
  if (nights !== null) return nights === 1 ? t('memberRewards.oneNight') : t('memberRewards.nightsPrice', { nights: formatNumber(nights) });
  return points === 1n ? t('memberRewards.onePoint') : t('memberRewards.price', { points: formatNumber(points ?? 0n) });
}

/** Where and how it is collected, with how many are left where the club counts them. */
const noteOf = (item: RewardItem) => (item.stock === null ? item.detail : t('memberRewards.leftLine', { count: formatNumber(item.stock), detail: item.detail }));

/** How far short the member is, in what the reward is priced in: `750 to go`, `1 night to go`, `0.75 nights to go`. */
function toGo({ unit, short }: RewardShortfall): string {
  if (unit === 'points') return t('memberRewards.toGo', { points: formatNumber(short) });
  return short === 1000n ? t('memberRewards.oneNightToGo') : t('memberRewards.nightsToGo', { nights: formatNights(short) });
}

/**
 * The redeem sheet (brief 3.8): Redeem, the reward, its cost and the points after, how it is collected, then Redeem or
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
          <DetailRow label={t('memberRewards.pointsAfter')} labelTone="muted" isLast value={t('memberRewards.price', { points: formatNumber(balance - item.points) })} />
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

/** One reward: its tile, name, cost in gold and note; Redeem, or how far short in what it is priced in, or none left. */
function RewardRow({ item, held, onRedeem }: { item: RewardItem; held: RewardsHeld; onRedeem: () => void }) {
  const shortfall = rewardShortfall(item, held);
  const isShort = shortfall !== null;
  const cta = item.stock === 0 ? t('memberRewards.noneLeft') : shortfall === null ? t('memberRewards.redeem') : toGo(shortfall);
  return (
    <Inline gap={3} align="center">
      <ItemPhoto src={item.photoUrl} name={item.name} size="sm" />
      <Stack gap={1} grow>
        <Text weight="medium">{item.name}</Text>
        <Text variant="small" tone="accent">{priceText(item)}</Text>
        <Text variant="caption" tone="muted">{noteOf(item)}</Text>
      </Stack>
      {/* Named from what it shows first (WCAG 2.5.3): "Redeem RIVR cap", or "1,500 to go, RIVR cap". */}
      <Button variant="outline" shape="pill" isDisabled={isShort || item.stock === 0}
        aria-label={isShort || item.stock === 0 ? t('memberRewards.unavailableName', { cta, name: item.name }) : t('memberRewards.redeemName', { name: item.name })}
        onClick={onRedeem}>{cta}</Button>
    </Inline>
  );
}

/**
 * The catalogue (brief 3.8): filter pills that wrap, so none is off-screen (All and each kind; F-187), a row a reward with
 * those sold out last, and the redeem sheet. Feature rewards.catalogue, gated by the screen.
 */
export function Catalogue({ held, hasNights }: { held: RewardsHeld; hasNights: boolean }) {
  const catalogue = useRewardCatalogue();
  const [kind, setKind] = useState<RewardKind | 'all'>('all');
  const [redeeming, setRedeeming] = useState<RewardItem | null>(null);
  // A tier without hotel nights gets none from the database, so no filter for them either (F-046).
  const kinds = REWARD_KINDS.filter((value) => hasNights || value !== 'hotel_night');
  const options = [{ value: 'all' as const, label: t('memberRewards.all') }, ...kinds.map((value) => ({ value, label: t(`memberRewards.kinds.${value}`) }))];
  // A skeleton while it comes, never the word Loading (brief 2.6); Try again if it cannot.
  if (catalogue.isError) return <LoadState isError onRetry={() => void catalogue.refetch()} />;
  if (catalogue.data === undefined) return <Skeleton rows={2} />;
  const shown = soldOutLast(catalogue.data.filter((item) => kind === 'all' || item.kind === kind));
  return (
    <Stack gap={4}>
      <ChoiceChips label={t('memberRewards.show')} isLabelVisuallyHidden look="pill" mode="one" selected={[kind]} options={options}
        onChange={(chosen) => setKind(chosen[0] ?? 'all')} />
      {shown.length === 0 ? <Text tone="muted">{t('memberRewards.noRewards')}</Text> : (
        <Stack gap={3} divided>{shown.map((item) => <RewardRow key={item.id} item={item} held={held} onRedeem={() => setRedeeming(item)} />)}</Stack>
      )}
      {redeeming === null ? null : <RedeemSheet item={redeeming} balance={held.points} onClose={() => setRedeeming(null)} />}
    </Stack>
  );
}
