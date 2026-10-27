import { REWARD_KINDS, type RewardKind } from '@rivr/contracts';
import { useRewardItems, type RewardItem } from '@rivr/db';
import { formatNumber, t } from '@rivr/i18n';
import { Button, ChoiceChips, Heading, Inline, Stack, Text } from '@rivr/ui';
import { useState } from 'react';

/** A price, or what a redemption took: "1 point", "4,000 points", or for a hotel night "1 night", "2 nights". */
export function priceText({ points, nights }: { points: bigint | null; nights: number | null }): string {
  if (nights !== null) return nights === 1 ? t('console.rewards.oneNight') : t('console.rewards.nights', { nights: formatNumber(nights) });
  return points === 1n ? t('console.rewards.onePoint') : t('console.rewards.points', { points: formatNumber(points ?? 0n) });
}

/** How many are left, or no limit. */
const stockText = (item: RewardItem) => (item.stock === null ? t('console.rewards.noLimit') : t('console.rewards.left', { count: formatNumber(item.stock) }));

/** One reward as the prototype lists it: name and kind line, price, stock, live or retired, and Edit for staff who keep it. */
function ItemRow({ item, canEdit, onEdit }: { item: RewardItem; canEdit: boolean; onEdit: (item: RewardItem) => void }) {
  return (
    <Inline justify="between" align="center" gap={6}>
      <Stack gap={1} grow>
        <Text weight="medium">{item.name}</Text>
        <Text variant="small" tone="muted">{t('console.rewards.itemLine', { kind: t(`console.rewards.kinds.${item.kind}`), detail: item.detail })}</Text>
      </Stack>
      <Text variant="small">{priceText(item)}</Text>
      <Text variant="small" tone="muted">{stockText(item)}</Text>
      <Text variant="small" tone={item.isLive ? 'money' : 'muted'}>{t(item.isLive ? 'console.rewards.live' : 'console.rewards.retired')}</Text>
      {canEdit ? (
        <Button variant="text" aria-label={t('console.rewards.editName', { name: item.name })} onClick={() => onEdit(item)}>{t('console.rewards.edit')}</Button>
      ) : null}
    </Inline>
  );
}

/** The rewards of the kind shown, or why there are none to show yet. */
function Rows({ venueId, kind, canEdit, onEdit }: { venueId: string; kind: RewardKind | 'all'; canEdit: boolean; onEdit: (item: RewardItem) => void }) {
  const items = useRewardItems(venueId);
  if (items.data === undefined) {
    return (
      <Stack gap={3}>
        <Text tone="muted">{t(items.isError ? 'common.loadFailed' : 'common.loading')}</Text>
        {items.isError ? <Inline><Button onClick={() => void items.refetch()}>{t('common.retry')}</Button></Inline> : null}
      </Stack>
    );
  }
  const shown = items.data.filter((item) => kind === 'all' || item.kind === kind);
  if (shown.length === 0) return <Text tone="muted">{t('console.rewards.noRewards')}</Text>;
  return <Stack gap={4} divided>{shown.map((item) => <ItemRow key={item.id} item={item} canEdit={canEdit} onEdit={onEdit} />)}</Stack>;
}

/** The venue's catalogue, live first and cheapest first, one kind or all; staff who keep it (`canEdit`) choose one to change. */
export function CatalogueList({ venueId, canEdit, onEdit }: { venueId: string; canEdit: boolean; onEdit: (item: RewardItem) => void }) {
  const [kind, setKind] = useState<RewardKind | 'all'>('all');
  const options: { value: RewardKind | 'all'; label: string }[] = [
    { value: 'all', label: t('console.rewards.all') }, ...REWARD_KINDS.map((value) => ({ value, label: t(`console.rewards.kinds.${value}`) })),
  ];
  return (
    <Stack gap={4}>
      <Heading level={2} variant="section">{t('console.rewards.catalogue')}</Heading>
      <ChoiceChips label={t('console.rewards.show')} mode="one" selected={[kind]} options={options} onChange={(chosen) => setKind(chosen[0] ?? 'all')} />
      <Rows venueId={venueId} kind={kind} canEdit={canEdit} onEdit={onEdit} />
    </Stack>
  );
}
