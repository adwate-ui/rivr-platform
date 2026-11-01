import { promotionBuilderSchema, type PromotionBuilder } from '@rivr/contracts';
import {
  usePromotionActions, usePromotionSimulation, usePromotionStakes, useStaffVenue, type PromotionSimulationResult, type PromotionStake,
  type SimulationFailure,
} from '@rivr/db';
import { promotionDraft } from '@rivr/domain/promotions';
import { t } from '@rivr/i18n';
import { Button, DisplayPreview, ErrorMessage, Grid, Heading, Inline, PromotionCard, Screen, Stack, Text, TextArea, TvPromotionSlide, StatusMessage } from '@rivr/ui';
import { useState } from 'react';
import { BuilderBlocks } from './BuilderBlocks.tsx';
import { BuilderBudget, budgetOf, NO_BUDGET, type TypedBudget } from './BuilderBudget.tsx';
import { rewardDetail, rewardTitle, runsText } from './promotionCopy.ts';
import { promotionWords } from './promotionWords.ts';
import { AwaitingApproval } from './AwaitingApproval.tsx';
import { RunningList } from './RunningList.tsx';
import { SentBack } from './SentBack.tsx';
import { SimulationPanel } from './SimulationPanel.tsx';
import { TemplatesList } from './TemplatesList.tsx';

// The bonus cap starts at 5,000 chips a buy-in, which the floor may change (question #415); the hours bonus at 1,000 chips
// after 4 hours, as the club's hours bonus template (#646).
const START: PromotionBuilder = {
  days: [], from: null, until: null, stake: null, reward: 'double_points', limit: 'none', bonus_cap_rupees: 5000, bonus_hours: 4, bonus_chips: 1000,
};

// The failure for each number the builder takes; any other is the window's.
const NUMBER_FAILURES = [['bonus_cap_rupees', 'invalidCap'], ['bonus_hours', 'invalidHours'], ['bonus_chips', 'invalidChips']] as const;

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
  const number = NUMBER_FAILURES.find(([field]) => checked.error.issues.some((issue) => issue.path[0] === field));
  return t(`console.promotions.failures.${number?.[1] ?? 'invalid'}`);
}

const NOT_SIMULATED = { simulation: null, failure: null } as const;

const NO_WORDS = { rules: '', questions: '' };

/** The promotion's rules and questions as the website shows them (#618), each box as promotionWords reads it. */
function WebWords({ words, isDisabled, onChange }: { words: typeof NO_WORDS; isDisabled: boolean; onChange: (next: typeof NO_WORDS) => void }) {
  return (
    <Stack gap={4}>
      <TextArea label={t('console.promotions.rules')} hint={t('console.promotions.rulesHint')} rows={4} value={words.rules} disabled={isDisabled}
        onChange={(event) => onChange({ ...words, rules: event.target.value })} />
      <TextArea label={t('console.promotions.questions')} hint={t('console.promotions.questionsHint')} rows={6} value={words.questions} disabled={isDisabled}
        onChange={(event) => onChange({ ...words, questions: event.target.value })} />
    </Stack>
  );
}

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

/** What to fix before the builder's promotion is simulated or submitted, or null. */
function invalidOf(choices: PromotionBuilder, budget: TypedBudget): string | null {
  return invalidText(choices) ?? (budgetOf(budget) === undefined ? t('console.promotions.invalidBuilderBudget') : null);
}

/** The builder's choices, its words for the website and its budget, with one request id for them, new with any change (A3). */
function useBuilderDraft() {
  const [choices, setChoices] = useState(START);
  const [words, setWords] = useState(NO_WORDS);
  const [budget, setBudget] = useState(NO_BUDGET);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID()); // Kept to retry a lost answer.
  const renew = () => setRequestId(crypto.randomUUID());
  return {
    choices, words, budget, requestId, renew,
    reset: () => { setChoices(START); setWords(NO_WORDS); setBudget(NO_BUDGET); },
    setChoices: (next: PromotionBuilder) => { setChoices(next); renew(); },
    setWords: (next: typeof NO_WORDS) => { setWords(next); renew(); },
    setBudget: (next: TypedBudget) => { setBudget(next); renew(); },
  };
}

function Builder({ venueId, stakes }: { venueId: string; stakes: readonly PromotionStake[] }) {
  const { submit: submitPromotion } = usePromotionActions(venueId);
  const simulation = useSimulation(venueId);
  const builder = useBuilderDraft();
  const { choices, words, budget } = builder;
  const [outcome, setOutcome] = useState<{ ok: boolean; text: string } | null>(null);
  const [title, detail, runs] = [rewardTitle(choices), rewardDetail(choices), runsText(choices, stakes)];
  const check = (then: () => Promise<void>) => {
    const invalid = invalidOf(choices, budget);
    return invalid === null ? then() : Promise.resolve(setOutcome({ ok: false, text: invalid }));
  };
  const submit = async () => {
    const webWords = promotionWords(words.rules, words.questions);
    const result = await submitPromotion.mutateAsync({ name: title, detail, runs, draft: promotionDraft(choices), ...webWords, requestId: builder.requestId, budget: budgetOf(budget) ?? null });
    if (result.ok || result.error !== 'unavailable') builder.renew();
    if (result.ok) { builder.reset(); simulation.clear(); }
    setOutcome(result.ok ? { ok: true, text: t('console.promotions.submitted', { name: title }) } : { ok: false, text: t(`console.promotions.failures.${result.error}`) });
  };
  const isBusy = submitPromotion.isPending || simulation.isPending;
  return (
    <Grid columns={2} gap={12} stackBelow="medium">
      <Stack gap={6}>
        <Heading level={2} variant="section">{t('console.promotions.newPromotion')}</Heading>
        <BuilderBlocks choices={choices} stakes={stakes} isDisabled={isBusy} onChange={(next) => { builder.setChoices(next); setOutcome(null); simulation.clear(); }} />
        <WebWords words={words} isDisabled={isBusy} onChange={builder.setWords} />
        <BuilderBudget value={budget} isDisabled={isBusy} onChange={(next) => { builder.setBudget(next); setOutcome(null); }} />
        <SimulationPanel simulation={simulation.simulation} failure={simulation.failure} isPending={simulation.isPending} isDisabled={submitPromotion.isPending}
          onSimulate={() => void check(() => simulation.run(choices))} />
        <Inline gap={4} align="center">
          <Button variant="primary" isLoading={submitPromotion.isPending} isDisabled={simulation.simulation === null || simulation.isPending}
            onClick={() => void check(submit)}>{t('console.promotions.submit')}</Button>
          <StatusMessage>{outcome?.ok === true ? outcome.text : null}</StatusMessage>
          {outcome === null && simulation.simulation === null ? <Text variant="small" tone="muted">{t('console.promotions.simulateFirst')}</Text> : null}
        </Inline>
        {outcome?.ok === false ? <ErrorMessage>{outcome.text}</ErrorMessage> : null}
      </Stack>
      <Previews title={title} detail={detail} runs={runs} />
    </Grid>
  );
}

function PromotionsBody({ venueId, mayApprove }: { venueId: string; mayApprove: boolean }) {
  const stakes = usePromotionStakes(venueId);
  const title = t('console.promotions.title');
  if (stakes.isPending) return <Screen title={title} status="loading" />;
  if (stakes.data === undefined) return <Screen title={title} status="error" onRetry={() => void stakes.refetch()} />;
  return (
    <Screen title={title}>
      <Stack gap={10}>
        <AwaitingApproval venueId={venueId} mayApprove={mayApprove} stakes={stakes.data} />
        <SentBack venueId={venueId} />
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
 * choices are simulated on last week first (#144), then submitted for a super admin, who approves or refuses it
 * (decision 0244). For staff who manage promotions.
 */
export function PromotionsScreen() {
  const staff = useStaffVenue();
  if (staff.status !== 'ready') return null;
  if (!staff.venue.permissions.includes('promotions.manage')) {
    return <Screen title={t('console.promotions.title')} status="error" errorText={t('console.promotions.notAllowed')} />;
  }
  return <PromotionsBody venueId={staff.venue.venueId} mayApprove={staff.venue.permissions.includes('promotions.approve')} />;
}
