import { useRewardItems, type RewardItem } from '@rivr/db';
import { formatNumber, t } from '@rivr/i18n';
import { Box, Button, DotStatus, Inline, LoadState, Skeleton, Stack, Text } from '@rivr/ui';

/** A price, or what a redemption took: "1 point", "4,000 points", or for a hotel night "1 night", "2 nights". */
export function priceText({ points, nights }: { points: bigint | null; nights: number | null }): string {
  if (nights !== null) return nights === 1 ? t('console.rewards.oneNight') : t('console.rewards.nights', { nights: formatNumber(nights) });
  return points === 1n ? t('console.rewards.onePoint') : t('console.rewards.points', { points: formatNumber(points ?? 0n) });
}

/** How many are left, or no limit. */
const stockText = (item: RewardItem) => (item.stock === null ? t('console.rewards.noLimit') : t('console.rewards.left', { count: formatNumber(item.stock) }));

/** One reward as the prototype lists it: name and kind line, price and stock, live or retired, and Edit for staff who keep it. */
function ItemRow({ item, canEdit, onEdit }: { item: RewardItem; canEdit: boolean; onEdit: (item: RewardItem) => void }) {
  return (
    <Box paddingX={4} paddingY={3}>
      <Inline justify="between" align="center" gap={4} wrap>
        <Stack gap={1} grow>
          <Text weight="medium">{item.name}</Text>
          <Text variant="small" tone="muted">{t('console.rewards.itemLine', { kind: t(`console.rewards.kinds.${item.kind}`), detail: item.detail })}</Text>
        </Stack>
        <Inline gap={4} align="center">
          <Text variant="small">{t('console.rewards.priceAndStock', { price: priceText(item), stock: stockText(item) })}</Text>
          <DotStatus tone={item.isLive ? 'active' : 'inactive'} label={t(item.isLive ? 'console.rewards.live' : 'console.rewards.retired')} />
          {canEdit ? (
            <Button variant="subtle" size="small" aria-label={t('console.rewards.editName', { name: item.name })} onClick={() => onEdit(item)}>
              {t('console.rewards.edit')}
            </Button>
          ) : null}
        </Inline>
      </Inline>
    </Box>
  );
}

/** The venue's catalogue, live first and cheapest first, on one raised panel; staff who keep it (`canEdit`) choose one to change. */
export function CatalogueList({ venueId, canEdit, onEdit }: { venueId: string; canEdit: boolean; onEdit: (item: RewardItem) => void }) {
  const items = useRewardItems(venueId);
  if (items.isError && items.data === undefined) return <LoadState isError onRetry={() => void items.refetch()} />;
  if (items.data === undefined) return <Skeleton look="rows" rows={4} />;
  if (items.data.length === 0) return <Text tone="muted">{t('console.rewards.noRewards')}</Text>;
  return (
    <Box as="section" surface="raised" radius="md" aria-label={t('console.rewards.catalogue')}>
      {items.data.map((item) => <ItemRow key={item.id} item={item} canEdit={canEdit} onEdit={onEdit} />)}
    </Box>
  );
}
