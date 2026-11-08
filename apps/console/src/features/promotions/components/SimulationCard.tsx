import type { PromotionSimulationResult, Reward } from '@rivr/contracts/promotionModel';
import { formatDayMonth, t } from '@rivr/i18n';
import { Box, Button, Grid, Heading, Inline, Number as Count, Stack, Text } from '@rivr/ui';

// What the third figure counts, by what the reward gives.
const MEASURE: Readonly<Record<Reward['kind'], keyof PromotionSimulationResult & ('points' | 'chips' | 'spins' | 'perks')>> = {
  points_multiplier: 'points', buyin_bonus: 'chips', seat_bonus: 'chips', hours_bonus: 'chips', bonus_chips: 'chips', free_spin: 'spins', cab_home: 'perks',
  tournament_entry: 'perks', waitlist_priority: 'perks',
};

// The replay ends at 06:00 IST, where today's club day begins; its last club day began a day before.
const DAY_MS = 86_400_000;

/** A simulation's figures: the members qualified, the times given, and what it gave of its kind. */
export interface SimulationShown {
  readonly kind: Reward['kind'];
  readonly result: PromotionSimulationResult;
  /** The club days replayed, when known; a simulation stored on a version keeps only its figures. */
  readonly period: { readonly from: Date; readonly to: Date } | null;
}

function Figure({ value, label }: { value: number; label: string }) {
  return (
    <Stack gap={1}>
      <Count value={value} size="lead" />
      <Text variant="caption" tone="muted">{label}</Text>
    </Stack>
  );
}

function Figures({ shown }: { shown: SimulationShown }) {
  const { result, period } = shown;
  const measure = MEASURE[shown.kind];
  return (
    <Stack gap={3}>
      {period === null ? null : (
        <Text variant="secondary" tone="muted">
          {t('console.promotions.simulation.period', { from: formatDayMonth(period.from), to: formatDayMonth(new Date(period.to.getTime() - DAY_MS)) })}
        </Text>
      )}
      <Grid columns={3} gap={2}>
        <Figure value={result.membersQualified} label={t('console.promotions.simulation.membersQualified')} />
        <Figure value={result.timesGiven} label={t('console.promotions.simulation.timesGiven')} />
        <Figure value={result[measure]} label={t(`console.promotions.simulation.measures.${measure}`)} />
      </Grid>
      {result.isBudgetReached ? <Text variant="secondary">{t('console.promotions.simulation.budgetReached')}</Text> : null}
    </Stack>
  );
}

interface SimulationCardProps {
  /** The simulation on the terms as they stand, or null when none has run on them. */
  shown: SimulationShown | null;
  /** Runs it on last week; the approver's view has none. */
  onSimulate?: (() => void) | undefined;
  isPending?: boolean;
  /** What stands in for the figures: how to run it, or that none is stored. */
  emptyText: string;
}

/** "Last week, if it had run" (decision 0471): the builder runs it before submitting, and the approver reads it. */
export function SimulationCard({ shown, onSimulate, isPending = false, emptyText }: SimulationCardProps) {
  return (
    <Box as="section" surface="raised" radius="lg" padding={4}>
      <Stack gap={3}>
        <Inline gap={4} justify="between" align="center">
          <Heading level={2} variant="card">{t('console.promotions.simulation.heading')}</Heading>
          {onSimulate === undefined ? null : (
            <Button variant="subtle" size="small" isLoading={isPending} onClick={onSimulate}>
              {t(shown === null ? 'console.promotions.simulation.simulate' : 'console.promotions.simulation.again')}
            </Button>
          )}
        </Inline>
        {shown === null ? <Text variant="secondary" tone="muted">{emptyText}</Text> : <Figures shown={shown} />}
      </Stack>
    </Box>
  );
}
