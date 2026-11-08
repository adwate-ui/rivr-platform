import { useSpinWheel, useSpinWheelActions, type SpinPrize } from '@rivr/db/spin';
import { formatNumber, t } from '@rivr/i18n';
import { Box, Button, ConfirmButton, DataTable, DataTableExportProvider, DotStatus, ErrorMessage, Heading, ProgressBar, Stack, type DataTableColumn } from '@rivr/ui';
import { useState } from 'react';
import { PrizeForm } from './PrizeForm.tsx';
import { prizeLabel } from './prizeLabel.ts';

// The spin budget is a rule of Settings' Members and rewards area (spin.budget), a part of its Settings tab.
const SPIN_BUDGET_SETTING = '/settings?tab=settings&part=members';

/** What the wheel's rows need to draw: the weights of the prizes that can be won now, and who may do what. */
interface WheelLook {
  readonly total: number;
  /** Staff who keep the wheel remove prizes; null for others. */
  readonly onRemove: ((prize: SpinPrize) => void) | null;
  /** Staff who open Settings' rules (settings.manage or venue.configure) get the way to the spin budget. */
  readonly canOpenSettings: boolean;
}

const oddsText = (prize: SpinPrize, total: number) => t('console.spin.oddsValue', { weight: formatNumber(prize.weight), odds: formatNumber(total) });

/**
 * A prize's odds: its weight's share of the prizes that can be won now as a bar; or, for a bonus this month's spin budget
 * cannot pay, why it is off the wheel, so a prize added never just fails to show.
 */
function OddsCell({ prize, total }: { prize: SpinPrize; total: number }) {
  if (prize.isDrawable) return <ProgressBar fraction={total === 0 ? 0 : prize.weight / total} />;
  return <DotStatus tone="danger" label={t('console.spin.budgetSpent')} />;
}

/** Its chance in words, "4 in 9"; off the wheel, "Off", or the way to the spin budget for staff who may change it. */
function ChanceCell({ prize, look }: { prize: SpinPrize; look: WheelLook }) {
  if (prize.isDrawable) return <>{oddsText(prize, look.total)}</>;
  if (!look.canOpenSettings) return <>{t('console.spin.offWheel')}</>;
  return <Button variant="text" size="small" href={SPIN_BUDGET_SETTING}>{t('console.spin.budgetLink')}</Button>;
}

/** What it gives, its odds, its chance, and Remove for staff who keep the wheel. */
function columnsFor(look: WheelLook): readonly DataTableColumn<SpinPrize>[] {
  const columns: DataTableColumn<SpinPrize>[] = [
    { key: 'prize', header: t('console.spin.prize'), cell: (row) => prizeLabel(row), filter: 'text', filterValue: (row) => prizeLabel(row) },
    { key: 'odds', filter: false, header: t('console.spin.odds'), isWide: true, cell: (row) => <OddsCell prize={row} total={look.total} /> },
    { key: 'chance', header: t('console.spin.chance'), align: 'end', cell: (row) => <ChanceCell prize={row} look={look} />,
      exportValue: (row) => (row.isDrawable ? oddsText(row, look.total) : t('console.spin.budgetSpent')) },
  ];
  const { onRemove } = look;
  if (onRemove === null) return columns;
  // Asked twice: a removed prize is gone from the wheel at once (F2-21).
  return [...columns, { key: 'remove', filter: false, header: t('console.spin.remove'), align: 'end', cell: (row) => (
    <ConfirmButton variant="text" size="small" label={t('console.spin.remove')} name={t('console.spin.removeName', { prize: prizeLabel(row) })}
      confirm={t('console.spin.confirmRemove', { prize: prizeLabel(row) })} onConfirm={() => onRemove(row)} />
  ) }];
}

interface WheelProps {
  readonly venueId: string;
  /** promotions.manage: add and remove prizes. */
  readonly canKeep: boolean;
  /** settings.manage or venue.configure: the link to the spin budget on Settings. */
  readonly canOpenSettings: boolean;
}

/** The prizes as a table, or its loading or error state. */
function PrizeRows({ venueId, canKeep, canOpenSettings }: WheelProps) {
  const wheel = useSpinWheel(venueId);
  const { remove } = useSpinWheelActions(venueId);
  const [failure, setFailure] = useState<string | null>(null);
  const total = (wheel.data ?? []).filter((prize) => prize.isDrawable).reduce((sum, prize) => sum + prize.weight, 0);
  const onRemove = canKeep ? (prize: SpinPrize) => void remove.mutateAsync(prize.prizeId).then((done) => {
    setFailure(done.ok ? null : t(`console.spin.failures.${done.error}`));
  }) : null;
  // On a phone the prizes keep their lines, scrolling sideways, so a bar and an off-the-wheel reason keep their room.
  const base = { label: t('console.spin.wheel'), columns: columnsFor({ total, onRemove, canOpenSettings }), rowKey: (row: SpinPrize) => row.prizeId, narrowLayout: 'scroll' as const };
  return (
    <>
      {wheel.data === undefined && wheel.isError ? <DataTable {...base} status="error" onRetry={() => void wheel.refetch()} /> : null}
      {wheel.data === undefined && !wheel.isError ? <DataTable {...base} status="loading" /> : null}
      {wheel.data === undefined ? null : <DataTable {...base} rows={wheel.data} emptyText={t('console.spin.noPrizes')} />}
      {failure === null ? null : <ErrorMessage>{failure}</ErrorMessage>}
    </>
  );
}

/**
 * The wheel's prizes in order (#150), with their odds, on one raised panel; staff who run promotions add and remove prizes.
 * No export: the prizes are the screen itself, not a record to keep.
 */
export function PrizeWheel(props: WheelProps) {
  return (
    <Box surface="raised" radius="md" padding={5}>
      <Stack gap={4}>
        <Heading level={2} variant="card">{t('console.spin.wheel')}</Heading>
        <DataTableExportProvider exporter={null}><PrizeRows {...props} /></DataTableExportProvider>
        {props.canKeep ? <PrizeForm venueId={props.venueId} /> : null}
      </Stack>
    </Box>
  );
}
