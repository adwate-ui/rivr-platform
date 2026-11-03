import { useSpinWheel, useSpinWheelActions, type SpinPrize } from '@rivr/db/spin';
import { formatNumber, t } from '@rivr/i18n';
import { Box, Button, ConfirmButton, DataTable, DotStatus, ErrorMessage, Heading, Inline, ProgressBar, Stack, Text, type DataTableColumn } from '@rivr/ui';
import { useState } from 'react';
import { PrizeForm } from './PrizeForm.tsx';
import { prizeLabel } from './prizeLabel.ts';

// The spin budget is a rule of the Members and rewards area on Settings (spin.budget).
const SPIN_BUDGET_SETTING = '/settings?tab=members';

/**
 * A prize's odds: its weight's share of the prizes that can be won now as a bar; or, for a bonus this month's spin budget
 * cannot pay, why it is off the wheel and where the budget is set, so a prize added never just fails to show.
 */
function OddsCell({ prize, total }: { prize: SpinPrize; total: number }) {
  if (prize.isDrawable) return <ProgressBar fraction={total === 0 ? 0 : prize.weight / total} />;
  return (
    <Inline gap={3} align="center" wrap>
      <DotStatus tone="danger" label={t('console.spin.budgetSpent')} />
      <Button variant="text" size="small" href={SPIN_BUDGET_SETTING}>{t('console.spin.budgetLink')}</Button>
    </Inline>
  );
}

/** What it gives, its odds, its chance in words ("4 in 9", or a dash off the wheel), and Remove for staff who keep the wheel. */
function columnsFor(total: number, onRemove: ((prize: SpinPrize) => void) | null): readonly DataTableColumn<SpinPrize>[] {
  const chance = (row: SpinPrize) => (row.isDrawable ? t('console.spin.oddsValue', { weight: formatNumber(row.weight), odds: formatNumber(total) }) : t('console.spin.offWheel'));
  const columns: DataTableColumn<SpinPrize>[] = [
    { key: 'prize', header: t('console.spin.prize'), cell: (row) => prizeLabel(row) },
    { key: 'odds', header: t('console.spin.odds'), isWide: true, cell: (row) => <OddsCell prize={row} total={total} /> },
    { key: 'chance', header: t('console.spin.chance'), align: 'end', cell: chance },
  ];
  if (onRemove === null) return columns;
  // Asked twice: a removed prize is gone from the wheel at once (F2-21).
  return [...columns, { key: 'remove', header: t('console.spin.remove'), align: 'end', cell: (row) => (
    <ConfirmButton label={t('console.spin.remove')} name={t('console.spin.removeName', { prize: prizeLabel(row) })}
      confirm={t('console.spin.confirmRemove', { prize: prizeLabel(row) })} onConfirm={() => onRemove(row)} />
  ) }];
}

/** The prizes as a table, or its loading or error state. */
function PrizeRows({ venueId, canKeep }: { venueId: string; canKeep: boolean }) {
  const wheel = useSpinWheel(venueId);
  const { remove } = useSpinWheelActions(venueId);
  const [failure, setFailure] = useState<string | null>(null);
  const total = (wheel.data ?? []).filter((prize) => prize.isDrawable).reduce((sum, prize) => sum + prize.weight, 0);
  const onRemove = canKeep ? (prize: SpinPrize) => void remove.mutateAsync(prize.prizeId).then((done) => {
    setFailure(done.ok ? null : t(`console.spin.failures.${done.error}`));
  }) : null;
  const base = { label: t('console.spin.wheel'), columns: columnsFor(total, onRemove), rowKey: (row: SpinPrize) => row.prizeId };
  return (
    <>
      {wheel.data === undefined && wheel.isError ? <DataTable {...base} status="error" onRetry={() => void wheel.refetch()} /> : null}
      {wheel.data === undefined && !wheel.isError ? <DataTable {...base} status="loading" /> : null}
      {wheel.data === undefined ? null : <DataTable {...base} rows={wheel.data} emptyText={t('console.spin.noPrizes')} />}
      {failure === null ? null : <ErrorMessage>{failure}</ErrorMessage>}
    </>
  );
}

/** The wheel's prizes in order (#150), with their odds, on one raised panel; staff who run promotions add and remove prizes. */
export function PrizeWheel({ venueId, canKeep }: { venueId: string; canKeep: boolean }) {
  return (
    <Box surface="raised" radius="md" padding={5}>
      <Stack gap={4}>
        <Inline justify="between" align="baseline" gap={3} wrap>
          <Heading level={2} variant="section">{t('console.spin.wheel')}</Heading>
          <Text variant="small" tone="muted">{t('console.spin.wheelHint')}</Text>
        </Inline>
        <PrizeRows venueId={venueId} canKeep={canKeep} />
        {canKeep ? <PrizeForm venueId={venueId} /> : null}
      </Stack>
    </Box>
  );
}
