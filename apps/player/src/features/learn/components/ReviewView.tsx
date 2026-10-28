import { crosstab2, type AttemptRow, type MatrixCell } from '@rivr/drills';
import { t } from '@rivr/i18n';
import { useFeature } from '@rivr/db';
import { Button, FeatureGate, Heading, Heatmap, Stack, type HeatmapBand, type HeatmapRow } from '@rivr/ui';

const STREETS = ['preflop', 'flop', 'turn', 'river'] as const;
const POSITIONS = ['UTG', 'UTG1', 'UTG2', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'];

/** A cell's band by its accuracy: too few answers to say, then strong, fair or weak. */
function bandOf(cell: MatrixCell): HeatmapBand {
  if (!cell.significant) return 'thin';
  const accuracy = 1 - cell.rate;
  return accuracy >= 0.8 ? 'strong' : accuracy >= 0.6 ? 'fair' : 'weak';
}

/** The heatmap's rows: each street answered, each position answered, each cell its accuracy over its answers. */
function heatmapOf(rows: readonly AttemptRow[]): { columns: string[]; rows: HeatmapRow[] } {
  const cells = crosstab2(rows, 'street', 'heroPosition');
  const columns = POSITIONS.filter((position) => cells.some((cell) => cell.column === position));
  const streets = STREETS.filter((street) => cells.some((cell) => cell.row === street));
  return {
    columns,
    rows: streets.map((street) => ({
      name: t(`player.learn.review.streets.${street}`),
      cells: columns.map((column) => {
        const cell = cells.find((each) => each.row === street && each.column === column);
        if (cell === undefined) return null;
        const right = cell.attempts - cell.errors;
        return {
          value: t('player.learn.summary.accuracyValue', { percent: Math.round((right * 100) / cell.attempts) }),
          detail: t('player.learn.review.cellDetail', { right, total: cell.attempts }), band: bandOf(cell),
        };
      }),
    })),
  };
}

/** The review (#136): the member's accuracy in this title by street and position, in four named bands. */
export function ReviewView({ rows, onBack }: { rows: readonly AttemptRow[]; onBack: () => void }) {
  const heatmap = heatmapOf(rows);
  return (
    <Stack gap={4}>
      <Heading level={2}>{t('player.learn.review.title')}</Heading>
      <FeatureGate access={useFeature('learn.review')}>
        <Heatmap label={t('player.learn.review.heatmap')} corner={t('player.learn.review.street')} columns={heatmap.columns} rows={heatmap.rows}
          emptyText={t('player.learn.review.empty')} />
      </FeatureGate>
      <Button variant="secondary" onClick={onBack}>{t('player.learn.review.back')}</Button>
    </Stack>
  );
}
