import { useHandOverRedemption, useVenueRedemptions, type Redemption } from '@rivr/db';
import { formatDayTime, t } from '@rivr/i18n';
import { Button, DataTable, ErrorMessage, Heading, Stack, type DataTableColumn } from '@rivr/ui';
import { useState } from 'react';
import { pointsText } from './CatalogueList.tsx';

/** Hands one redemption over; a refusal shows under the button. */
function HandOverButton({ venueId, redemption }: { venueId: string; redemption: Redemption }) {
  const handOver = useHandOverRedemption(venueId);
  const [failure, setFailure] = useState<string | null>(null);
  const press = async () => {
    const done = await handOver.mutateAsync(redemption.id);
    setFailure(done.ok ? null : t(`console.rewards.failures.${done.error}`));
  };
  return (
    <Stack gap={1}>
      <Button variant="secondary" isLoading={handOver.isPending} onClick={() => void press()}
        aria-label={t('console.rewards.handOverName', { reward: redemption.rewardName, name: redemption.fullName })}>
        {t('console.rewards.handOver')}
      </Button>
      {failure === null ? null : <ErrorMessage>{failure}</ErrorMessage>}
    </Stack>
  );
}

/** Member, reward and points, then when it was redeemed and, once handed over, who did it and when. */
function columns(venueId: string, isWaiting: boolean): readonly DataTableColumn<Redemption>[] {
  const common: DataTableColumn<Redemption>[] = [
    {
      key: 'member', header: t('console.rewards.member'), sortValue: (row) => row.fullName,
      cell: (row) => t('console.rewards.memberLine', { name: row.fullName, number: row.memberNumber }),
    },
    { key: 'reward', header: t('console.rewards.reward'), cell: (row) => row.rewardName, sortValue: (row) => row.rewardName },
    { key: 'points', header: t('console.rewards.price'), align: 'end', cell: (row) => pointsText(row.points), sortValue: (row) => row.points },
    { key: 'redeemed', header: t('console.rewards.redeemed'), cell: (row) => formatDayTime(new Date(row.createdAt)), sortValue: (row) => row.createdAt },
  ];
  if (isWaiting) return [...common, { key: 'handOver', header: t('console.rewards.handOver'), cell: (row) => <HandOverButton venueId={venueId} redemption={row} /> }];
  return [...common, {
    key: 'handedOver', header: t('console.rewards.handedOverBy'),
    cell: (row) => t('console.rewards.handedOverLine', { name: row.handedOverBy ?? '', when: row.handedOverAt === null ? '' : formatDayTime(new Date(row.handedOverAt)) }),
  }];
}

interface SectionProps {
  readonly venueId: string;
  readonly isWaiting: boolean;
  /** The redemptions to list, or the list still loading or failed (`onRetry` asks again). */
  readonly rows: readonly Redemption[] | 'loading' | 'error';
  readonly onRetry: () => void;
}

function Section({ venueId, isWaiting, rows, onRetry }: SectionProps) {
  const label = t(isWaiting ? 'console.rewards.waiting' : 'console.rewards.handedOver');
  const base = { label, columns: columns(venueId, isWaiting), rowKey: (row: Redemption) => row.id };
  const emptyText = t(isWaiting ? 'console.rewards.noneWaiting' : 'console.rewards.noneHandedOver');
  return (
    <Stack gap={4}>
      <Heading level={2} variant="section">{label}</Heading>
      {rows === 'loading' ? <DataTable {...base} status="loading" /> : null}
      {rows === 'error' ? <DataTable {...base} status="error" onRetry={onRetry} /> : null}
      {typeof rows === 'object' ? <DataTable {...base} rows={rows} emptyText={emptyText} /> : null}
    </Stack>
  );
}

/** The venue's redemptions, for staff who hand them over: those waiting, each with its button, then 30 days handed over. */
export function RedemptionList({ venueId }: { venueId: string }) {
  const redemptions = useVenueRedemptions(venueId);
  const state = redemptions.data ?? (redemptions.isError ? 'error' : 'loading');
  const pick = (isWaiting: boolean) => (typeof state === 'object' ? state.filter((row) => (row.handedOverAt === null) === isWaiting) : state);
  const retry = () => void redemptions.refetch();
  return (
    <Stack gap={8}>
      <Section venueId={venueId} isWaiting rows={pick(true)} onRetry={retry} />
      <Section venueId={venueId} isWaiting={false} rows={pick(false)} onRetry={retry} />
    </Stack>
  );
}
