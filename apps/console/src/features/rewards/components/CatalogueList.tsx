import { useRewardItems, useRewardRedemptionCounts, type RewardItem } from '@rivr/db';
import { soldOutLast, stockLevel } from '@rivr/domain/rewards';
import { formatNumber, t } from '@rivr/i18n';
import { Box, Button, DotStatus, Inline, LoadState, Skeleton, Stack, Text, type DotStatusTone } from '@rivr/ui';

/** A price, or what a redemption took: "1 point", "4,000 points", or for a hotel night "1 night", "2 nights". */
export function priceText({ points, nights }: { points: bigint | null; nights: number | null }): string {
  if (nights !== null) return nights === 1 ? t('console.rewards.oneNight') : t('console.rewards.nights', { nights: formatNumber(nights) });
  return points === 1n ? t('console.rewards.onePoint') : t('console.rewards.points', { points: formatNumber(points ?? 0n) });
}

/** How many are left, or no limit. */
const stockText = (item: RewardItem) => (item.stock === null ? t('console.rewards.noLimit') : t('console.rewards.left', { count: formatNumber(item.stock) }));

/** A reward's status: retired; or, live, sold out in gold (it waits on staff to restock or retire it), low, or live (F-072). */
function statusOf(item: RewardItem): { tone: DotStatusTone; label: string } {
  if (!item.isLive) return { tone: 'inactive', label: t('console.rewards.retired') };
  const level = stockLevel(item.stock);
  if (level === 'sold_out') return { tone: 'needsYou', label: t('console.rewards.soldOut') };
  return { tone: 'active', label: t(level === 'low' ? 'console.rewards.low' : 'console.rewards.live') };
}

interface ItemRowProps {
  item: RewardItem;
  /** How many went in the last 30 days; undefined until read. */
  redeemed: number | undefined;
  canEdit: boolean;
  onEdit: (item: RewardItem) => void;
}

/** One reward as the prototype lists it: name and kind line, price and stock, redeemed lately, its status, and Edit for staff who keep it. */
function ItemRow({ item, redeemed, canEdit, onEdit }: ItemRowProps) {
  return (
    <Box paddingX={4} paddingY={3}>
      <Inline justify="between" align="center" gap={4} wrap>
        <Stack gap={1} grow>
          <Text variant="row" weight="medium">{item.name}</Text>
          <Text variant="secondary" tone="muted">{t('console.rewards.itemLine', { kind: t(`console.rewards.kinds.${item.kind}`), detail: item.detail })}</Text>
        </Stack>
        <Inline gap={4} align="center">
          <Text variant="secondary">{t('console.rewards.priceAndStock', { price: priceText(item), stock: stockText(item) })}</Text>
          {redeemed === undefined ? null : <Text variant="secondary" tone="muted">{t('console.rewards.redeemed30', { count: formatNumber(redeemed) })}</Text>}
          <DotStatus {...statusOf(item)} />
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

/** The venue's catalogue on one raised panel: live first, cheapest first, sold out at the end of the live ones (F-072), then retired; staff who keep it (`canEdit`) choose one to change. */
export function CatalogueList({ venueId, canEdit, onEdit }: { venueId: string; canEdit: boolean; onEdit: (item: RewardItem) => void }) {
  const items = useRewardItems(venueId);
  const counts = useRewardRedemptionCounts(venueId).data;
  if (items.isError && items.data === undefined) return <LoadState isError onRetry={() => void items.refetch()} />;
  if (items.data === undefined) return <Skeleton look="rows" rows={4} />;
  if (items.data.length === 0) return <Text tone="muted">{t('console.rewards.noRewards')}</Text>;
  return (
    <Box as="section" surface="raised" radius="md" aria-label={t('console.rewards.catalogue')}>
      {[...soldOutLast(items.data.filter((item) => item.isLive)), ...items.data.filter((item) => !item.isLive)].map((item) => (
        <ItemRow key={item.id} item={item} redeemed={counts === undefined ? undefined : counts.get(item.id) ?? 0} canEdit={canEdit} onEdit={onEdit} />
      ))}
    </Box>
  );
}
