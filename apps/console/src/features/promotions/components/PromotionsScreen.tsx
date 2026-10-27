import { promotionBuilderSchema, type PromotionBuilder } from '@rivr/contracts';
import {
  usePromotionActions, usePromotionSimulation, usePromotionStakes, useStaffVenue, type PromotionSimulationResult, type PromotionStake,
  type SimulationFailure,
} from '@rivr/db';
import { promotionDraft } from '@rivr/domain/promotions';
import { t } from '@rivr/i18n';
import { Button, DisplayPreview, ErrorMessage, Grid, Heading, Inline, PromotionCard, Screen, Stack, Text, TvPromotionSlide } from '@rivr/ui';
import { useState } from 'react';
import { BuilderBlocks } from './BuilderBlocks.tsx';
import { rewardDetail, rewardTitle, runsText } from './promotionCopy.ts';
import { RunningList } from './RunningList.tsx';
import { SimulationPanel } from './SimulationPanel.tsx';
import { TemplatesList } from './TemplatesList.tsx';

// The bonus cap starts at ₹5,000 a buy-in, which the floor may change (question #415).
const START: PromotionBuilder = { days: [], from: null, until: null, stake: null, reward: 'double_points', limit: 'none', bonus_cap_rupees: 5000 };

/** The player card and the TV slide, as the choices so far would publish them. */
function Previews({ title, detail, runs }: { title: string; detail: string | undefined; runs: string }) {
  return (
    <Stack gap={6}>
      <Stack gap={2}>
        <Text variant="label" tone="muted">{t('console.promotions.playerApp')}</Text>
        <PromotionCard title={title} detail={detail} runs={runs} />
      </Stack>
      <Stack gap={2}>
        <Text variant="label" tone="muted">{t('console.promotions.tvSlide')}</Text>
        <DisplayPreview label={t('console.promotions.tvSlide')}>
          <TvPromotionSlide label={t('console.promotions.slideLabel')} title={title} detail={detail} when={runs} />
        </DisplayPreview>
      </Stack>
    </Stack>
  );
}

/** Why the choices cannot be published as they stand, or null when they can. */
function invalidText(choices: PromotionBuilder): string | null {
  const checked = promotionBuilderSchema.safeParse(choices);
  if (checked.success) return null;
  const isCap = checked.error.issues.some((issue) => issue.path[0] === 'bonus_cap_rupees');
  return t(isCap ? 'console.promotions.failures.invalidCap' : 'console.promotions.failures.invalid');
}

const NOT_SIMULATED = { simulation: null, failure: null } as const;

/** The simulation of the choices as they stand (#144): any change clears it, and publishing waits for it. */
function useSimulation(venueId: string) {
  const simulate = usePromotionSimulation(venueId);
  const [state, setState] = useState<{ simulation: PromotionSimulationResult | null; failure: SimulationFailure | null }>(NOT_SIMULATED);
  const run = async (choices: PromotionBuilder) => {
    const result = await simulate.mutateAsync(promotionDraft(choices));
    setState(result.ok ? { simulation: result.value, failure: null } : { simulation: null, failure: result.error });
  };
  return { ...state, isPending: simulate.isPending, run, clear: () => setState(NOT_SIMULATED) };
}

function Builder({ venueId, stakes }: { venueId: string; stakes: readonly PromotionStake[] }) {
  const { publish } = usePromotionActions(venueId);
  const simulation = useSimulation(venueId);
  const [choices, setChoices] = useState(START);
  const [outcome, setOutcome] = useState<{ ok: boolean; text: string } | null>(null);
  const title = rewardTitle(choices);
  const detail = rewardDetail(choices);
  const runs = runsText(choices, stakes);
  const check = (then: () => Promise<void>) => {
    const invalid = invalidText(choices);
    return invalid === null ? then() : Promise.resolve(setOutcome({ ok: false, text: invalid }));
  };
  const submit = async () => {
    const result = await publish.mutateAsync({ name: title, detail, runs, draft: promotionDraft(choices) });
    if (result.ok) { setChoices(START); simulation.clear(); }
    setOutcome(result.ok ? { ok: true, text: t('console.promotions.published', { name: title }) } : { ok: false, text: t(`console.promotions.failures.${result.error}`) });
  };
  const isBusy = publish.isPending || simulation.isPending;
  return (
    <Grid columns={2} gap={12}>
      <Stack gap={6}>
        <Heading level={2} variant="section">{t('console.promotions.newPromotion')}</Heading>
        <BuilderBlocks choices={choices} stakes={stakes} isDisabled={isBusy} onChange={(next) => { setChoices(next); setOutcome(null); simulation.clear(); }} />
        <SimulationPanel simulation={simulation.simulation} failure={simulation.failure} isPending={simulation.isPending} isDisabled={publish.isPending}
          onSimulate={() => void check(() => simulation.run(choices))} />
        <Inline gap={4} align="center">
          <Button variant="primary" isLoading={publish.isPending} isDisabled={simulation.simulation === null || simulation.isPending}
            onClick={() => void check(submit)}>{t('console.promotions.publish')}</Button>
          {outcome?.ok === true ? <Text>{outcome.text}</Text> : null}
          {outcome === null && simulation.simulation === null ? <Text variant="small" tone="muted">{t('console.promotions.simulateFirst')}</Text> : null}
        </Inline>
        {outcome?.ok === false ? <ErrorMessage>{outcome.text}</ErrorMessage> : null}
      </Stack>
      <Previews title={title} detail={detail} runs={runs} />
    </Grid>
  );
}

function PromotionsBody({ venueId }: { venueId: string }) {
  const stakes = usePromotionStakes(venueId);
  const title = t('console.promotions.title');
  if (stakes.isPending) return <Screen title={title} status="loading" />;
  if (stakes.data === undefined) return <Screen title={title} status="error" onRetry={() => void stakes.refetch()} />;
  return (
    <Screen title={title}>
      <Stack gap={10}>
        <RunningList venueId={venueId} />
        <TemplatesList venueId={venueId} />
        <Builder venueId={venueId} stakes={stakes.data} />
      </Stack>
    </Screen>
  );
}

/**
 * Promotions (#84; design prompt Promotions, flow 7): what is running, paused and resumed in place,
 * and the builder's four blocks with the player card and the TV slide previewed beside them. The
 * choices are simulated on last week first (#144); Publish then puts the promotion live. For staff
 * who manage promotions.
 */
export function PromotionsScreen() {
  const staff = useStaffVenue();
  if (staff.status !== 'ready') return null;
  if (!staff.venue.permissions.includes('promotions.manage')) {
    return <Screen title={t('console.promotions.title')} status="error" errorText={t('console.promotions.notAllowed')} />;
  }
  return <PromotionsBody venueId={staff.venue.venueId} />;
}
