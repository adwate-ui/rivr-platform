import { useSpin, useSpinWheel, useWaitingSpins, type WaitingSpin } from '@rivr/db/spin';
import { formatDayTime, formatNumber, t } from '@rivr/i18n';
import { Box, Button, DataTable, DataTableExportProvider, ErrorMessage, Heading, Inline, Stack, StatusMessage, Text, type DataTableColumn } from '@rivr/ui';
import { useState, type ReactNode } from 'react';
import { prizeLabel } from './prizeLabel.ts';

/** Spin waits while the wheel has no prize to draw (C-08): whether it may spin, and whether to say why not. */
function useDrawState(venueId: string, waiting: readonly WaitingSpin[] | undefined) {
  const prizes = useSpinWheel(venueId).data;
  const canDraw = prizes?.some((prize) => prize.isDrawable) ?? false;
  // Said only once the wheel is read: while it loads, or failed to (its own table says so), Spin just waits.
  return { canDraw, saysWhy: prizes !== undefined && !canDraw && (waiting?.length ?? 0) > 0 };
}

/** The list's heading and how many wait, and why Spin waits when it does. */
function WaitingHeading({ saysWhy, count }: { saysWhy: boolean; count: number | undefined }) {
  return (
    <Stack gap={2}>
      <Inline justify="between" align="baseline" gap={3}>
        <Heading level={2} variant="card">{t('console.spin.waiting')}</Heading>
        {count === undefined ? null : <Text variant="secondary" tone="muted">{formatNumber(count)}</Text>}
      </Inline>
      {saysWhy ? <Text>{t('console.spin.noDrawable')}</Text> : null}
    </Stack>
  );
}

/** Who, from which promotion, given when, and the button to spin it. */
function columnsFor(spinButton: (row: WaitingSpin) => ReactNode): readonly DataTableColumn<WaitingSpin>[] {
  return [
    { key: 'member', header: t('console.spin.member'), cell: (row) => row.memberName },
    { key: 'promotion', header: t('console.spin.promotion'), cell: (row) => row.promotionName },
    { key: 'granted', header: t('console.spin.granted'), cell: (row) => formatDayTime(new Date(row.grantedAt)) },
    { key: 'spin', header: t('console.spin.spin'), align: 'end', cell: spinButton },
  ];
}

/** The spins as a table, or its loading or error state. */
function WaitingRows({ waiting, columns }: { waiting: ReturnType<typeof useWaitingSpins>; columns: readonly DataTableColumn<WaitingSpin>[] }) {
  const base = { label: t('console.spin.waiting'), columns, rowKey: (row: WaitingSpin) => row.grantId };
  if (waiting.data !== undefined) return <DataTable {...base} rows={waiting.data} emptyText={t('console.spin.noneWaiting')} />;
  return waiting.isError ? <DataTable {...base} status="error" onRetry={() => void waiting.refetch()} /> : <DataTable {...base} status="loading" />;
}

/**
 * The spins waiting (#150), on a raised panel: each member with a spin from a promotion, and the button to spin it with
 * them there, the TVs showing the prize; then what they won. Spin waits while the wheel has no prize to draw (C-08).
 */
export function WaitingSpins({ venueId }: { venueId: string }) {
  const waiting = useWaitingSpins(venueId);
  const spin = useSpin(venueId);
  const { canDraw, saysWhy } = useDrawState(venueId, waiting.data);
  const [outcome, setOutcome] = useState<{ ok: boolean; text: string } | null>(null);
  const spinFor = (row: WaitingSpin) => void spin.mutateAsync(row.grantId).then((done) => {
    setOutcome(done.ok ? { ok: true, text: t('console.spin.won', { name: row.memberName, prize: prizeLabel(done.value) }) }
      : { ok: false, text: t(`console.spin.failures.${done.error}`) });
  });
  const spinButton = (row: WaitingSpin) => (
    <Button variant="strong" size="small" isLoading={spin.isPending && spin.variables === row.grantId} isDisabled={spin.isPending || !canDraw}
      onClick={() => { setOutcome(null); spinFor(row); }} aria-label={t('console.spin.spinFor', { name: row.memberName })}>
      {t('console.spin.spin')}
    </Button>
  );
  return (
    <Box surface="raised" radius="md" padding={5}>
      <Stack gap={4}>
        <WaitingHeading saysWhy={saysWhy} count={waiting.data?.length} />
        {/* No export: the spins are the night's work, not a record to keep. */}
        <DataTableExportProvider exporter={null}><WaitingRows waiting={waiting} columns={columnsFor(spinButton)} /></DataTableExportProvider>
        <StatusMessage>{outcome?.ok === true ? outcome.text : null}</StatusMessage>
        {outcome?.ok === false ? <ErrorMessage>{outcome.text}</ErrorMessage> : null}
      </Stack>
    </Box>
  );
}
