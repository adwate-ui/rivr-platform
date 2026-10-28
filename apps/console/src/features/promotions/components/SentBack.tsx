import { usePromotionsSentBack } from '@rivr/db';
import { formatDayTime, t } from '@rivr/i18n';
import { Heading, Stack, Text, LoadState } from '@rivr/ui';

/**
 * Promotions a super admin sent back in the last fortnight (#144; decision 0244), newest first, with who sent each
 * back and why, so the one who submitted it knows what to change. Nothing shows when none was sent back.
 */
export function SentBack({ venueId }: { venueId: string }) {
  const sentBack = usePromotionsSentBack(venueId);
  const heading = <Heading level={2} variant="section">{t('console.promotions.sentBack.heading')}</Heading>;
  if (sentBack.isError) {
    return (
      <Stack gap={4}>
        {heading}
        <LoadState isError onRetry={() => void sentBack.refetch()} />
      </Stack>
    );
  }
  if (sentBack.data === undefined || sentBack.data.length === 0) return null;
  return (
    <Stack gap={4}>
      {heading}
      <Stack gap={4} divided>
        {sentBack.data.map((promotion) => (
          <Stack key={promotion.id} gap={1}>
            <Text weight="medium">{promotion.name}</Text>
            <Text variant="small">
              {t('console.promotions.sentBack.line', { name: promotion.refusedBy, time: formatDayTime(new Date(promotion.refusedAt)), reason: promotion.reason })}
            </Text>
            <Text variant="small" tone="muted">{t(promotion.isTemplate ? 'console.promotions.sentBack.template' : 'console.promotions.sentBack.built')}</Text>
          </Stack>
        ))}
      </Stack>
    </Stack>
  );
}
