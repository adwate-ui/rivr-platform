import type { PromotionSimulationResult, SimulationFailure } from '@rivr/db';
import { formatDayMonth, t } from '@rivr/i18n';
import { Button, ErrorMessage, Heading, Inline, Money, Number as Count, Stack, Text } from '@rivr/ui';
import type { ReactNode } from 'react';

// The replay ends at 06:00 IST, where today's club day begins; its last club day began a day before.
const DAY_MS = 86_400_000;

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Inline justify="between" align="center" gap={6}>
      <Text>{label}</Text>
      {children}
    </Inline>
  );
}

function Figures({ simulation }: { simulation: PromotionSimulationResult }) {
  return (
    <Stack gap={3} divided>
      <Row label={t('console.promotions.simulation.replayed')}><Count value={simulation.events} /></Row>
      <Row label={t('console.promotions.simulation.grants')}><Count value={simulation.grants} /></Row>
      <Row label={t('console.promotions.simulation.members')}><Count value={simulation.members} /></Row>
      <Row label={t('console.promotions.simulation.cost')}><Money paise={simulation.cost} /></Row>
      <Row label={t('console.promotions.simulation.points')}><Count value={simulation.points} /></Row>
      {simulation.budgetLeft === null ? (
        <Row label={t('console.promotions.simulation.budget')}><Text tone="muted">{t('console.promotions.simulation.noCap')}</Text></Row>
      ) : (
        <Row label={t('console.promotions.simulation.budgetLeft')}><Money paise={simulation.budgetLeft} /></Row>
      )}
    </Stack>
  );
}

function Outcome({ simulation }: { simulation: PromotionSimulationResult }) {
  const period = t('console.promotions.simulation.period', {
    from: formatDayMonth(simulation.from), to: formatDayMonth(new Date(simulation.to.getTime() - DAY_MS)),
  });
  return (
    <Stack gap={4}>
      <Text variant="small" tone="muted">{period}</Text>
      {simulation.grants === 0 ? <Text tone="muted">{t('console.promotions.simulation.nothing')}</Text> : null}
      <Figures simulation={simulation} />
      {simulation.isBudgetReached ? <Text>{t('console.promotions.simulation.budgetReached')}</Text> : null}
    </Stack>
  );
}

/**
 * The simulation before publishing (#144; scope-v1 module 7 controls): the promotion as chosen, replayed on
 * last week's seven club days, with what it would have given and cost. Any change to the choices clears it.
 */
export function SimulationPanel({ simulation, failure, isPending, isDisabled, onSimulate }: {
  simulation: PromotionSimulationResult | null;
  failure: SimulationFailure | null;
  isPending: boolean;
  isDisabled: boolean;
  onSimulate: () => void;
}) {
  return (
    <Stack gap={4}>
      <Inline justify="between" align="center" gap={6}>
        <Heading level={3} variant="section">{t('console.promotions.simulation.heading')}</Heading>
        <Button isLoading={isPending} isDisabled={isDisabled} onClick={onSimulate}>{t('console.promotions.simulate')}</Button>
      </Inline>
      {isPending ? <Text tone="muted">{t('console.promotions.simulation.replaying')}</Text> : null}
      {failure === null ? null : <ErrorMessage>{t(`console.promotions.simulation.failures.${failure}`)}</ErrorMessage>}
      {simulation === null || isPending ? null : <Outcome simulation={simulation} />}
    </Stack>
  );
}
