import { usePromotionActions, usePromotions, type ConsolePromotion } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, ErrorMessage, Heading, Inline, Stack, Text } from '@rivr/ui';
import { useId, useState } from 'react';

function PromotionRow({ venueId, promotion }: { venueId: string; promotion: ConsolePromotion }) {
  const { setLive } = usePromotionActions(venueId);
  const [failure, setFailure] = useState<string | null>(null);
  const nameId = useId();
  const line = [promotion.detail, promotion.runs].filter((part) => part !== null).join(' · ');
  const toggle = async () => {
    const result = await setLive.mutateAsync({ id: promotion.id, isLive: !promotion.isLive });
    setFailure(result.ok ? null : t(`console.promotions.failures.${result.error}`));
  };
  return (
    <Stack gap={2}>
      <Inline justify="between" align="center" gap={6}>
        <Stack gap={1} grow>
          <Text weight="medium" id={nameId}>{promotion.name}</Text>
          {line === '' ? null : <Text variant="small" tone="muted">{line}</Text>}
        </Stack>
        <Text variant="small" tone={promotion.isLive ? 'money' : 'muted'}>{t(promotion.isLive ? 'console.promotions.live' : 'console.promotions.paused')}</Text>
        <Button variant="text" isLoading={setLive.isPending} onClick={() => void toggle()} aria-describedby={nameId}>
          {t(promotion.isLive ? 'console.promotions.pause' : 'console.promotions.resume')}
        </Button>
      </Inline>
      {failure === null ? null : <ErrorMessage>{failure}</ErrorMessage>}
    </Stack>
  );
}

/** What is running (#84): each live or paused promotion with its card's words, paused and resumed in place. */
export function RunningList({ venueId }: { venueId: string }) {
  const promotions = usePromotions(venueId);
  const heading = <Heading level={2} variant="section">{t('console.promotions.running')}</Heading>;
  if (promotions.data === undefined) {
    return (
      <Stack gap={4}>
        {heading}
        <Text tone="muted">{t(promotions.isError ? 'common.loadFailed' : 'common.loading')}</Text>
        {promotions.isError ? <Inline><Button onClick={() => void promotions.refetch()}>{t('common.retry')}</Button></Inline> : null}
      </Stack>
    );
  }
  return (
    <Stack gap={4}>
      {heading}
      {promotions.data.length === 0 ? <Text tone="muted">{t('console.promotions.empty')}</Text> : (
        <Stack gap={4} divided>
          {promotions.data.map((promotion) => <PromotionRow key={promotion.id} venueId={venueId} promotion={promotion} />)}
        </Stack>
      )}
    </Stack>
  );
}
