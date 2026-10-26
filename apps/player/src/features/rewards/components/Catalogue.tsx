import { REWARD_KINDS, type RewardKind } from '@rivr/contracts/rewardKinds';
import type { RewardItem } from '@rivr/db';
import { useRedeemReward, useRewardCatalogue } from '@rivr/db/myRewards';
import { formatNumber, t } from '@rivr/i18n';
import { Button, ChoiceChips, ErrorMessage, Heading, Inline, Stack, Text } from '@rivr/ui';
import { useState } from 'react';

/** A price in points: "1 point", "4,000 points". */
export const priceText = (points: bigint) => (points === 1n ? t('memberRewards.onePoint') : t('memberRewards.price', { points: formatNumber(points) }));

/** How many are left with where to collect it, or only where for a reward with no limit. */
const leftText = (item: RewardItem) => (item.stock === null ? item.detail : t('memberRewards.leftLine', { count: formatNumber(item.stock), detail: item.detail }));

/** Asks before the points are taken, then redeems once for this tap's request id. */
function Confirm({ item, onDone }: { item: RewardItem; onDone: (outcome: { ok: boolean; text: string }) => void }) {
  const redeem = useRedeemReward();
  const [requestId] = useState(() => crypto.randomUUID());
  const press = async () => {
    const done = await redeem.mutateAsync({ itemId: item.id, points: item.points, requestId });
    onDone(done.ok ? { ok: true, text: t('memberRewards.redeemed', { detail: item.detail }) } : { ok: false, text: t(`memberRewards.failures.${done.error}`) });
  };
  return (
    <Stack gap={2}>
      <Text>{t('memberRewards.confirm', { name: item.name, points: formatNumber(item.points) })}</Text>
      <Inline gap={3}>
        <Button variant="primary" isLoading={redeem.isPending} onClick={() => void press()}>{t('memberRewards.confirmYes')}</Button>
        <Button variant="text" onClick={() => onDone({ ok: true, text: '' })}>{t('memberRewards.cancel')}</Button>
      </Inline>
    </Stack>
  );
}

/** One reward: its name, price and what is left; Redeem asks first, then says where to collect it. */
function RewardRow({ item }: { item: RewardItem }) {
  const [isAsking, setIsAsking] = useState(false);
  const [outcome, setOutcome] = useState<{ ok: boolean; text: string } | null>(null);
  const finish = (next: { ok: boolean; text: string }) => { setIsAsking(false); setOutcome(next.text === '' ? null : next); };
  return (
    <Stack gap={3}>
      <Inline justify="between" align="center" gap={4}>
        <Stack gap={1} grow>
          <Text weight="medium">{item.name}</Text>
          <Text variant="small">{priceText(item.points)}</Text>
          <Text variant="small" tone="muted">{leftText(item)}</Text>
        </Stack>
        {isAsking ? null : (
          <Button variant="secondary" aria-label={t('memberRewards.redeemName', { name: item.name })}
            onClick={() => { setOutcome(null); setIsAsking(true); }}>{t('memberRewards.redeem')}</Button>
        )}
      </Inline>
      {isAsking ? <Confirm item={item} onDone={finish} /> : null}
      {outcome?.ok === true ? <Text tone="money">{outcome.text}</Text> : null}
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

/** The catalogue (#145; feature rewards.catalogue): the club's live rewards, one kind or all, each redeemed with points. */
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
