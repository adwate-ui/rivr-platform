import { useSpinWheel, useSpinWheelActions, type SpinPrize } from '@rivr/db/spin';
import { formatNumber, t } from '@rivr/i18n';
import { Button, DataTable, ErrorMessage, Heading, Stack, Text, type DataTableColumn } from '@rivr/ui';
import { useState } from 'react';
import { prizeLabel } from './prizeLabel.ts';

/** A prize's columns: what it gives, and its odds as its weight out of the prizes that can be drawn, or that the budget is spent. */
function columnsFor(odds: number, onRemove: ((prize: SpinPrize) => void) | null): readonly DataTableColumn<SpinPrize>[] {
  const columns: DataTableColumn<SpinPrize>[] = [
    { key: 'prize', header: t('console.spin.prize'), cell: (row) => prizeLabel(row) },
    { key: 'odds', header: t('console.spin.odds'), align: 'end',
      cell: (row) => (row.isDrawable ? t('console.spin.oddsValue', { weight: formatNumber(row.weight), odds: formatNumber(odds) }) : t('console.spin.budgetSpent')) },
  ];
  if (onRemove === null) return columns;
  return [...columns, { key: 'remove', header: t('console.spin.remove'), align: 'end', cell: (row) => (
    <Button variant="text" aria-label={t('console.spin.removeName', { prize: prizeLabel(row) })} onClick={() => onRemove(row)}>{t('console.spin.remove')}</Button>
  ) }];
}

/** The wheel's prizes in order (#150), with their odds; staff who run promotions take one off. */
export function PrizeTable({ venueId, canRemove }: { venueId: string; canRemove: boolean }) {
  const wheel = useSpinWheel(venueId);
  const { remove } = useSpinWheelActions(venueId);
  const [failure, setFailure] = useState<string | null>(null);
  const odds = (wheel.data ?? []).filter((prize) => prize.isDrawable).reduce((total, prize) => total + prize.weight, 0);
  const onRemove = canRemove ? (prize: SpinPrize) => void remove.mutateAsync(prize.prizeId).then((done) => {
    setFailure(done.ok ? null : t(`console.spin.failures.${done.error}`));
  }) : null;
  const base = { label: t('console.spin.wheel'), columns: columnsFor(odds, onRemove), rowKey: (row: SpinPrize) => row.prizeId };
  return (
    <Stack gap={4}>
      <Heading level={2} variant="section">{t('console.spin.wheel')}</Heading>
      <Text variant="small" tone="muted">{t('console.spin.wheelHint')}</Text>
      {wheel.data === undefined && wheel.isError ? <DataTable {...base} status="error" onRetry={() => void wheel.refetch()} /> : null}
      {wheel.data === undefined && !wheel.isError ? <DataTable {...base} status="loading" /> : null}
      {wheel.data === undefined ? null : <DataTable {...base} rows={wheel.data} emptyText={t('console.spin.noPrizes')} />}
      {failure === null ? null : <ErrorMessage>{failure}</ErrorMessage>}
    </Stack>
  );
}
