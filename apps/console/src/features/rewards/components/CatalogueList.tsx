import { useRewardItems, type RewardItem } from '@rivr/db';
import { formatNumber, t } from '@rivr/i18n';
import { Button, Heading, Inline, Stack, Text } from '@rivr/ui';

/** How many are left, or no limit. */
const stockText = (item: RewardItem) => (item.stock === null ? t('console.rewards.noLimit') : t('console.rewards.left', { count: formatNumber(item.stock) }));

function ItemRow({ item, canEdit, onEdit }: { item: RewardItem; canEdit: boolean; onEdit: (item: RewardItem) => void }) {
  return (
    <Inline justify="between" align="center" gap={6}>
      <Stack gap={1} grow>
        <Text weight="medium">{item.name}</Text>
        <Text variant="small" tone="muted">{t('console.rewards.itemLine', { kind: t(`console.rewards.kinds.${item.kind}`), detail: item.detail })}</Text>
      </Stack>
      <Text variant="small">{t('console.rewards.points', { points: formatNumber(item.points) })}</Text>
      <Text variant="small" tone="muted">{stockText(item)}</Text>
      <Text variant="small" tone={item.isLive ? 'money' : 'muted'}>{t(item.isLive ? 'console.rewards.live' : 'console.rewards.retired')}</Text>
      {canEdit ? (
        <Button variant="text" aria-label={t('console.rewards.editName', { name: item.name })} onClick={() => onEdit(item)}>{t('console.rewards.edit')}</Button>
      ) : null}
    </Inline>
  );
}

/** The venue's catalogue, live first and cheapest first; staff who keep it (`canEdit`) choose one to change. */
export function CatalogueList({ venueId, canEdit, onEdit }: { venueId: string; canEdit: boolean; onEdit: (item: RewardItem) => void }) {
  const items = useRewardItems(venueId);
  const heading = <Heading level={2} variant="section">{t('console.rewards.catalogue')}</Heading>;
  if (items.data === undefined) {
    return (
      <Stack gap={4}>
        {heading}
        <Text tone="muted">{t(items.isError ? 'common.loadFailed' : 'common.loading')}</Text>
        {items.isError ? <Inline><Button onClick={() => void items.refetch()}>{t('common.retry')}</Button></Inline> : null}
      </Stack>
    );
  }
  return (
    <Stack gap={4}>
      {heading}
      {items.data.length === 0 ? <Text tone="muted">{t('console.rewards.noRewards')}</Text> : (
        <Stack gap={4} divided>
          {items.data.map((item) => <ItemRow key={item.id} item={item} canEdit={canEdit} onEdit={onEdit} />)}
        </Stack>
      )}
    </Stack>
  );
}
