import { useSpin, useWaitingSpins, type WaitingSpin } from '@rivr/db/spin';
import { formatDayTime, t } from '@rivr/i18n';
import { Button, DataTable, ErrorMessage, Heading, Stack, StatusMessage, Text, type DataTableColumn } from '@rivr/ui';
import { useState } from 'react';
import { prizeLabel } from './prizeLabel.ts';

/** The spins waiting (#150): each member with a spin from a promotion, and the floor's button to spin it; then what they won. */
export function WaitingSpins({ venueId }: { venueId: string }) {
  const waiting = useWaitingSpins(venueId);
  const spin = useSpin(venueId);
  const [outcome, setOutcome] = useState<{ ok: boolean; text: string } | null>(null);
  const spinFor = (row: WaitingSpin) => void spin.mutateAsync(row.grantId).then((done) => {
    setOutcome(done.ok ? { ok: true, text: t('console.spin.won', { name: row.memberName, prize: prizeLabel(done.value) }) }
      : { ok: false, text: t(`console.spin.failures.${done.error}`) });
  });
  const columns: readonly DataTableColumn<WaitingSpin>[] = [
    { key: 'member', header: t('console.spin.member'), cell: (row) => row.memberName },
    { key: 'promotion', header: t('console.spin.promotion'), cell: (row) => row.promotionName },
    { key: 'granted', header: t('console.spin.granted'), cell: (row) => formatDayTime(new Date(row.grantedAt)) },
    { key: 'spin', header: t('console.spin.spin'), align: 'end', cell: (row) => (
      <Button variant="secondary" isLoading={spin.isPending && spin.variables === row.grantId} isDisabled={spin.isPending}
        onClick={() => { setOutcome(null); spinFor(row); }}
        aria-label={t('console.spin.spinFor', { name: row.memberName })}>
        {t('console.spin.spin')}
      </Button>
    ) },
  ];
  const base = { label: t('console.spin.waiting'), columns, rowKey: (row: WaitingSpin) => row.grantId };
  return (
    <Stack gap={4}>
      <Heading level={2} variant="section">{t('console.spin.waiting')}</Heading>
      <Text variant="small" tone="muted">{t('console.spin.waitingHint')}</Text>
      {waiting.data === undefined && waiting.isError ? <DataTable {...base} status="error" onRetry={() => void waiting.refetch()} /> : null}
      {waiting.data === undefined && !waiting.isError ? <DataTable {...base} status="loading" /> : null}
      {waiting.data === undefined ? null : <DataTable {...base} rows={waiting.data} emptyText={t('console.spin.noneWaiting')} />}
      <StatusMessage>{outcome?.ok === true ? outcome.text : null}</StatusMessage>
      {outcome?.ok === false ? <ErrorMessage>{outcome.text}</ErrorMessage> : null}
    </Stack>
  );
}
