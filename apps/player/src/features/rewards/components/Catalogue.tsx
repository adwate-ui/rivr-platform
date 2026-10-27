import { REWARD_KINDS, type RewardKind } from '@rivr/contracts/rewardKinds';
import type { RewardItem } from '@rivr/db';
import { useRedeemReward, useRewardCatalogue } from '@rivr/db/myRewards';
import { formatNumber, t } from '@rivr/i18n';
import { Button, ChoiceChips, ErrorMessage, Heading, Inline, Stack, Text, StatusMessage } from '@rivr/ui';
import { useState } from 'react';

/** A price, or what a redemption took: "1 point", "4,000 points", or for a hotel night "1 night", "2 nights". */
export function priceText({ points, nights }: { points: bigint | null; nights: number | null }): string {
  if (nights !== null) return nights === 1 ? t('memberRewards.oneNight') : t('memberRewards.nightsPrice', { nights: formatNumber(nights) });
  return points === 1n ? t('memberRewards.onePoint') : t('memberRewards.price', { points: formatNumber(points ?? 0n) });
}

/** How many are left with where to collect it, or only where for a reward with no limit. */
const leftText = (item: RewardItem) => (item.stock === null ? item.detail : t('memberRewards.leftLine', { count: formatNumber(item.stock), detail: item.detail }));

type Outcome = { ok: true; text: string } | { ok: false; text: string } | null;

/**
 * Asks before the points or nights are taken, then redeems for the row's request id. The id outlives a failed try
 * when it is not known whether the redemption went through (`unavailable`), so trying again never
 * redeems twice; any answer the server gave starts a new one.
 */
function Confirm({ item, requestId, onDone }: { item: RewardItem; requestId: string; onDone: (outcome: Outcome, isSettled: boolean) => void }) {
  const redeem = useRedeemReward();
  const press = async () => {
    const done = await redeem.mutateAsync({ itemId: item.id, points: item.points, nights: item.nights, requestId });
    if (done.ok) return onDone({ ok: true, text: t('memberRewards.redeemed', { detail: item.detail }) }, true);
    return onDone({ ok: false, text: t(`memberRewards.failures.${done.error}`) }, done.error !== 'unavailable');
  };
  return (
    <Stack gap={2}>
      <Text>{t('memberRewards.confirm', { name: item.name, price: priceText(item) })}</Text>
      <Inline gap={3}>
        <Button variant="primary" isLoading={redeem.isPending} onClick={() => void press()}>{t('memberRewards.confirmYes')}</Button>
        <Button variant="text" onClick={() => onDone(null, false)}>{t('memberRewards.cancel')}</Button>
      </Inline>
    </Stack>
  );
}

/** One reward: its name, price and what is left; Redeem asks first, then says where to collect it. None left, it says so. */
function RewardRow({ item }: { item: RewardItem }) {
  const [isAsking, setIsAsking] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const finish = (next: Outcome, isSettled: boolean) => {
    setIsAsking(false);
    setOutcome(next);
    if (isSettled) setRequestId(crypto.randomUUID());
  };
  const action = item.stock === 0 ? <Text variant="small" tone="muted">{t('memberRewards.noneLeft')}</Text> : (
    <Button variant="secondary" aria-label={t('memberRewards.redeemName', { name: item.name })}
      onClick={() => { setOutcome(null); setIsAsking(true); }}>{t('memberRewards.redeem')}</Button>
  );
  return (
    <Stack gap={3}>
      <Inline justify="between" align="center" gap={4}>
        <Stack gap={1} grow>
          <Text weight="medium">{item.name}</Text>
          <Text variant="small">{priceText(item)}</Text>
          <Text variant="small" tone="muted">{leftText(item)}</Text>
        </Stack>
        {isAsking ? null : action}
      </Inline>
      {isAsking ? <Confirm item={item} requestId={requestId} onDone={finish} /> : null}
      <StatusMessage>{outcome?.ok === true ? outcome.text : null}</StatusMessage>
      {outcome?.ok === false ? <ErrorMessage>{outcome.text}</ErrorMessage> : null}
    </Stack>
  );
}

/** The rewards of the kind shown, or why there are none. */
function Rows({ kind }: { kind: RewardKind | 'all' }) {
  const catalogue = useRewardCatalogue();
  if (catalogue.data === undefined) {
    return (
      <Stack gap={3}>
        <Text tone="muted">{t(catalogue.isError ? 'common.loadFailed' : 'common.loading')}</Text>
        {catalogue.isError ? <Inline><Button onClick={() => void catalogue.refetch()}>{t('common.retry')}</Button></Inline> : null}
      </Stack>
    );
  }
  const shown = catalogue.data.filter((item) => kind === 'all' || item.kind === kind);
  if (shown.length === 0) return <Text tone="muted">{t('memberRewards.noRewards')}</Text>;
  return <Stack gap={4} divided>{shown.map((item) => <RewardRow key={item.id} item={item} />)}</Stack>;
}

/** The catalogue (#145; feature rewards.catalogue): the club's live rewards, one kind or all, each redeemed with points, or hotel nights with nights. */
export function Catalogue() {
  const [kind, setKind] = useState<RewardKind | 'all'>('all');
  const options: { value: RewardKind | 'all'; label: string }[] = [
    { value: 'all', label: t('memberRewards.all') }, ...REWARD_KINDS.map((value) => ({ value, label: t(`memberRewards.kinds.${value}`) })),
  ];
  return (
    <Stack gap={4}>
      <Heading level={2}>{t('memberRewards.catalogue')}</Heading>
      <ChoiceChips label={t('memberRewards.show')} mode="one" selected={[kind]} options={options} onChange={(chosen) => setKind(chosen[0] ?? 'all')} />
      <Rows kind={kind} />
    </Stack>
  );
}
