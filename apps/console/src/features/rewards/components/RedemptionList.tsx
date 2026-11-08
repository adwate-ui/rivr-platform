import { zodResolver } from '@hookform/resolvers/zod';
import { cancelRedemptionSchema } from '@rivr/contracts';
import { useCancelRedemption, useHandOverRedemption, useVenueRedemptions, type Redemption } from '@rivr/db';
import { formatDayTime, t } from '@rivr/i18n';
import { Box, Button, DataTable, ErrorMessage, Heading, Inline, ReasonForm, Stack, type DataTableColumn } from '@rivr/ui';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { priceText } from './CatalogueList.tsx';

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
      <Button variant="strong" size="small" isLoading={handOver.isPending} onClick={() => void press()}
        aria-label={t('console.rewards.handOverName', { reward: redemption.rewardName, name: redemption.fullName })}>
        {t('console.rewards.handOver')}
      </Button>
      {failure === null ? null : <ErrorMessage>{failure}</ErrorMessage>}
    </Stack>
  );
}

/** Cancels one redemption not yet handed over, with a reason, after Cancel opens the form (#462); the form's own Cancel closes it (F2-22). */
function CancelRedemption({ venueId, redemption }: { venueId: string; redemption: Redemption }) {
  const cancel = useCancelRedemption(venueId);
  const [isOpen, setIsOpen] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [resolver] = useState(() => zodResolver(cancelRedemptionSchema));
  const form = useForm<z.input<typeof cancelRedemptionSchema>, unknown, z.output<typeof cancelRedemptionSchema>>({ resolver, defaultValues: { reason: '' } });
  const submit = form.handleSubmit(async ({ reason }) => {
    const done = await cancel.mutateAsync({ redemptionId: redemption.id, reason });
    setFailure(done.ok ? null : t(`console.rewards.failures.${done.error}`));
  });
  const names = { reward: redemption.rewardName, name: redemption.fullName };
  if (!isOpen) {
    return (
      <Button variant="text" size="small" onClick={() => setIsOpen(true)} aria-label={t('console.rewards.cancelRedemptionName', names)}>
        {t('console.rewards.cancelRedemption')}
      </Button>
    );
  }
  return (
    <Stack gap={2}>
      <ReasonForm field={form.register('reason')} label={t('console.rewards.cancelRedemptionReason', names)} hint={t('console.fnb.memberSeesReason')}
        error={form.formState.errors.reason ? t('console.rewards.invalidCancelReason') : undefined}
        actions={[{ label: t('console.rewards.cancelRedemptionConfirm'), onClick: () => void submit() }]} isLoading={cancel.isPending}
        onCancel={() => setIsOpen(false)} />
      {failure === null ? null : <ErrorMessage>{failure}</ErrorMessage>}
    </Stack>
  );
}

/** A redemption waiting at the desk: hand it over, or cancel it. */
function WaitingActions({ venueId, redemption }: { venueId: string; redemption: Redemption }) {
  return (
    <Inline gap={2} align="start" wrap>
      <HandOverButton venueId={venueId} redemption={redemption} />
      <CancelRedemption venueId={venueId} redemption={redemption} />
    </Inline>
  );
}

/** Member, reward and what it took, then when it was redeemed and, once handed over, who did it and when. */
function columns(venueId: string, isWaiting: boolean): readonly DataTableColumn<Redemption>[] {
  const common: DataTableColumn<Redemption>[] = [
    {
      key: 'member', header: t('console.rewards.member'), sortValue: (row) => row.fullName, filter: 'text', filterValue: (row) => row.fullName,
      cell: (row) => t('console.rewards.memberLine', { name: row.fullName, number: row.memberNumber }),
    },
    { key: 'reward', header: t('console.rewards.reward'), cell: (row) => row.rewardName, sortValue: (row) => row.rewardName, filter: 'choice' },
    { key: 'price', header: t('console.rewards.priceColumn'), align: 'end', cell: (row) => priceText(row), sortValue: (row) => row.points ?? 0n },
    { key: 'redeemed', header: t('console.rewards.redeemed'), cell: (row) => formatDayTime(new Date(row.createdAt)), sortValue: (row) => row.createdAt },
  ];
  if (isWaiting) return [...common, { key: 'handOver', header: t('console.rewards.handOver'), cell: (row) => <WaitingActions venueId={venueId} redemption={row} /> }];
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
    <Box surface="raised" radius="md" padding={5}>
      <Stack gap={4}>
        <Heading level={2} variant="card">{label}</Heading>
        {rows === 'loading' ? <DataTable {...base} status="loading" /> : null}
        {rows === 'error' ? <DataTable {...base} status="error" onRetry={onRetry} /> : null}
        {typeof rows === 'object' ? <DataTable {...base} rows={rows} emptyText={emptyText} /> : null}
      </Stack>
    </Box>
  );
}

/** The venue's redemptions, for staff who hand them over: those waiting, each with its button, then 30 days handed over. */
export function RedemptionList({ venueId }: { venueId: string }) {
  const redemptions = useVenueRedemptions(venueId);
  const state = redemptions.data ?? (redemptions.isError ? 'error' : 'loading');
  const pick = (isWaiting: boolean) => (typeof state === 'object' ? state.filter((row) => (row.handedOverAt === null) === isWaiting) : state);
  const retry = () => void redemptions.refetch();
  return (
    <Stack gap={6}>
      <Section venueId={venueId} isWaiting rows={pick(true)} onRetry={retry} />
      <Section venueId={venueId} isWaiting={false} rows={pick(false)} onRetry={retry} />
    </Stack>
  );
}
