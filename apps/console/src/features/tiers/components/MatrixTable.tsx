import { cellKey, type TierCell, type TierMatrix as Matrix } from '@rivr/db';
import { formatDate, t } from '@rivr/i18n';
import { Button, ChoiceChips, Heading, Inline, Stack, Text, TierMatrix } from '@rivr/ui';
import { CELL_STATES, STATE_LABEL, stateOf, type CellState } from './tierCopy.ts';

interface CellControlProps {
  names: { feature: string; tier: string };
  cell: TierCell;
  /** The choice made on screen and not yet saved, if any. */
  pending: CellState | undefined;
  isBusy: boolean;
  onChange: (state: CellState) => void;
  onWithdraw: (cellId: string) => void;
}

/** One cell: on, locked or hidden, and the change already saved for later, which can be withdrawn. */
function CellControl({ names, cell, pending, isBusy, onChange, onWithdraw }: CellControlProps) {
  const next = cell.next;
  return (
    <Stack gap={1}>
      <ChoiceChips label={t('console.tiers.cellFor', names)} isLabelVisuallyHidden mode="one" selected={[pending ?? stateOf(cell)]}
        isDisabled={isBusy} options={CELL_STATES.map((value) => ({ value, label: t(STATE_LABEL[value]) }))}
        onChange={(states) => { if (states[0] !== undefined) onChange(states[0]); }} />
      {next === null ? null : (
        <Inline gap={2} align="center" wrap>
          <Text variant="small" tone="muted">{t('console.tiers.scheduled', { date: formatDate(new Date(next.from)), state: t(STATE_LABEL[stateOf(next)]) })}</Text>
          <Button variant="text" isDisabled={isBusy} aria-label={t('console.tiers.withdrawFor', names)} onClick={() => onWithdraw(next.cellId)}>
            {t('console.tiers.withdraw')}
          </Button>
        </Inline>
      )}
    </Stack>
  );
}

interface MatrixTableProps {
  matrix: Matrix;
  pending: ReadonlyMap<string, CellState>;
  isBusy: boolean;
  onChange: (tierId: string, featureKey: string, state: CellState) => void;
  onWithdraw: (cellId: string) => void;
}

/** The tier x feature matrix (additions "Tier-gated features"): a row per gateable feature, a column per tier, a choice per cell. */
export function MatrixTable({ matrix, pending, isBusy, onChange, onWithdraw }: MatrixTableProps) {
  const rows = matrix.features.map((feature) => ({
    key: feature.key,
    name: feature.name,
    description: feature.description,
    cells: Object.fromEntries(matrix.tiers.map((tier) => {
      const key = cellKey(tier.tierId, feature.key);
      const cell = matrix.cells.get(key);
      return [tier.tierId, cell === undefined ? null : (
        <CellControl names={{ feature: feature.name, tier: tier.name }} cell={cell} pending={pending.get(key)} isBusy={isBusy}
          onChange={(state) => onChange(tier.tierId, feature.key, state)} onWithdraw={onWithdraw} />
      )];
    })),
  }));
  return (
    <Stack gap={4}>
      <Heading level={2}>{t('console.tiers.matrix')}</Heading>
      <TierMatrix label={t('console.tiers.matrix')} featureHeader={t('console.tiers.feature')} rows={rows} emptyText={t('console.tiers.empty')}
        tiers={matrix.tiers.map((tier) => ({ id: tier.tierId, name: tier.name }))} />
    </Stack>
  );
}
