import { useHandOverRedemption, useVenueRedemptions, type Redemption } from '@rivr/db';
import { formatDayTime, formatNumber, t } from '@rivr/i18n';
import { Button, ErrorMessage, Heading, Inline, Stack, Text } from '@rivr/ui';
import { useState, type ReactNode } from 'react';

/** Who redeemed what, for how many points, and when. */
export function redemptionLine(redemption: Redemption): string {
  return t('console.rewards.redemptionLine', {
    name: redemption.fullName, number: redemption.memberNumber, reward: redemption.rewardName, points: formatNumber(redemption.points),
    when: formatDayTime(new Date(redemption.createdAt)),
  });
}

function WaitingRow({ venueId, redemption, canHandOver }: { venueId: string; redemption: Redemption; canHandOver: boolean }) {
  const handOver = useHandOverRedemption(venueId);
  const [failure, setFailure] = useState<string | null>(null);
  const press = async () => {
    const done = await handOver.mutateAsync(redemption.id);
    setFailure(done.ok ? null : t(`console.rewards.failures.${done.error}`));
  };
  return (
    <Stack gap={2}>
      <Inline justify="between" align="center" gap={6}>
        <Text>{redemptionLine(redemption)}</Text>
        {canHandOver ? (
          <Button variant="secondary" isLoading={handOver.isPending} onClick={() => void press()}
            aria-label={t('console.rewards.handOverName', { reward: redemption.rewardName, name: redemption.fullName })}>
            {t('console.rewards.handOver')}
          </Button>
        ) : null}
      </Inline>
      {failure === null ? null : <ErrorMessage>{failure}</ErrorMessage>}
    </Stack>
  );
}

function HandedOverRow({ redemption }: { redemption: Redemption }) {
  const by = redemption.handedOverBy ?? '';
  const when = redemption.handedOverAt === null ? '' : formatDayTime(new Date(redemption.handedOverAt));
  return (
    <Stack gap={1}>
      <Text>{redemptionLine(redemption)}</Text>
      <Text variant="small" tone="muted">{t('console.rewards.handedOverLine', { name: by, when })}</Text>
    </Stack>
  );
}

function Section({ title, emptyText, children }: { title: string; emptyText: string; children: readonly ReactNode[] }) {
  return (
    <Stack gap={4}>
      <Heading level={2} variant="section">{title}</Heading>
      {children.length === 0 ? <Text tone="muted">{emptyText}</Text> : <Stack gap={4} divided>{children}</Stack>}
    </Stack>
  );
}

/** The venue's redemptions: those waiting, which staff who may (`canHandOver`) hand over, then 30 days handed over. */
export function RedemptionList({ venueId, canHandOver }: { venueId: string; canHandOver: boolean }) {
  const redemptions = useVenueRedemptions(venueId);
  if (redemptions.data === undefined) {
    return (
      <Stack gap={4}>
        <Heading level={2} variant="section">{t('console.rewards.waiting')}</Heading>
        <Text tone="muted">{t(redemptions.isError ? 'common.loadFailed' : 'common.loading')}</Text>
        {redemptions.isError ? <Inline><Button onClick={() => void redemptions.refetch()}>{t('common.retry')}</Button></Inline> : null}
      </Stack>
    );
  }
  const waiting = redemptions.data.filter((redemption) => redemption.handedOverAt === null);
  const done = redemptions.data.filter((redemption) => redemption.handedOverAt !== null);
  return (
    <Stack gap={8}>
      <Section title={t('console.rewards.waiting')} emptyText={t('console.rewards.noneWaiting')}>
        {waiting.map((redemption) => <WaitingRow key={redemption.id} venueId={venueId} redemption={redemption} canHandOver={canHandOver} />)}
      </Section>
      <Section title={t('console.rewards.handedOver')} emptyText={t('console.rewards.noneHandedOver')}>
        {done.map((redemption) => <HandedOverRow key={redemption.id} redemption={redemption} />)}
      </Section>
    </Stack>
  );
}
