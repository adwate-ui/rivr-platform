import type { PromotionTerms } from '@rivr/contracts/promotionModel';
import type { Result } from '@rivr/contracts/result';
import type { PromotionVersionFailure } from '@rivr/db';
import { clubDay } from '@rivr/domain/clubDay';
import { sameTerms, transition, type Actor, type Terms } from '@rivr/domain/promotions';
import { t } from '@rivr/i18n';
import { Box, Button, ErrorMessage, Grid, Stack, Text, useToast } from '@rivr/ui';
import { useMemo, useState } from 'react';
import { useBuilderFlow, type FlowStart, type SimulationOnTerms } from '../hooks/useBuilderFlow.ts';
import type { BuilderNames } from '../hooks/useBuilderNames.ts';
import type { SectionProps } from './BuilderCard.tsx';
import { BuilderFrame, StartCard } from './BuilderFrame.tsx';
import { templateForm, type BuilderForm, type TemplateKey } from './builderForm.ts';
import { readForm, type FormField } from './formTerms.ts';
import { LimitsSection, WhereSection } from './LimitsWhereSections.tsx';
import { RewardSection } from './RewardSection.tsx';
import { SimulationCard, type SimulationShown } from './SimulationCard.tsx';
import { SummaryCards } from './SummaryCards.tsx';
import { WhenSection, WhoSection } from './WhoWhenSections.tsx';

/** Where the builder starts: its fields, its title, a line about the draft above the sections, and the draft it changes. */
export interface BuilderStart extends FlowStart {
  readonly form: BuilderForm;
  readonly title: string;
  /** A draft sent back and why, or that the running version runs on until this one is approved. */
  readonly notice: string | null;
}

interface PromotionBuilderProps {
  venueId: string;
  names: BuilderNames;
  /** The staff member, whose permissions the status machine reads. */
  actor: Actor;
  start: BuilderStart;
  /** Back to the list, after Save draft or Submit for approval too. */
  onDone: () => void;
}

const NO_ERRORS: ReadonlySet<FormField> = new Set();

/** The simulation to show: the one run on the terms as they stand, or none once a term changes. */
function shownOf(simulation: SimulationOnTerms | null, core: Terms | null): SimulationShown | null {
  if (simulation === null || core === null || !sameTerms(simulation.terms, core)) return null;
  const period = simulation.from === null || simulation.to === null ? null : { from: simulation.from, to: simulation.to };
  return { kind: simulation.terms.reward.kind, result: simulation.result, period };
}

/** Whether Submit for approval may be pressed: the status machine's own rule, a simulation on these very terms (decision 0437). */
function maySubmit(simulation: SimulationOnTerms | null, core: Terms | null, actor: Actor): boolean {
  if (simulation === null || core === null) return false;
  return transition({ status: 'draft', authorId: null, terms: core, simulatedTerms: simulation.terms }, { kind: 'submit' }, actor).ok;
}

type Step = (terms: PromotionTerms) => Promise<Result<string, PromotionVersionFailure>>;

/** The builder's fields and its calls: each call reads the terms first, marking the fields they refuse. */
function useBuilder(venueId: string, start: BuilderStart, names: BuilderNames, onDone: () => void) {
  const [form, setForm] = useState(start.form);
  const [template, setTemplate] = useState<TemplateKey | null>(start.promotionId === null ? 'blank' : null);
  const [isMarking, setIsMarking] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const flow = useBuilderFlow(venueId, start, names.names);
  const toast = useToast();
  const reading = useMemo(() => readForm(form), [form]);
  const run = async (step: Step, said?: 'saved' | 'submitted') => {
    if (reading.terms === null) {
      setIsMarking(true);
      setFailure(t('console.promotions.builder.fixFields'));
      return;
    }
    const outcome = await step(reading.terms);
    setFailure(outcome.ok ? null : t(`console.promotions.failures.${outcome.error}`));
    if (outcome.ok && said !== undefined) {
      toast(t(`console.promotions.toast.${said}`, { name: reading.terms.name }));
      onDone();
    }
  };
  const change = (next: BuilderForm) => { setForm(next); setFailure(null); };
  const applyTemplate = (key: TemplateKey) => { setTemplate(key); change(templateForm(key, clubDay(new Date()), names.templateTiers)); };
  return { form, template, reading, flow, failure, errors: isMarking ? reading.errors : NO_ERRORS, change, applyTemplate, run };
}

/**
 * The promotion builder (console v3, phase 7; ConsolePromotions prototype): "Start from" and the name, then five numbered
 * sections, beside a column held in view with the one-line summary, the TV slide, last week's simulation, Save draft and
 * Submit for approval, which waits for a simulation on the terms as they stand (decision 0437).
 */
export function PromotionBuilder({ venueId, names, actor, start, onDone }: PromotionBuilderProps) {
  const builder = useBuilder(venueId, start, names, onDone);
  const { form, reading, flow } = builder;
  const section: SectionProps = { form, errors: builder.errors, onChange: builder.change, isReadOnly: false };
  const title = form.name.trim() === '' ? t(`console.promotions.builder.rewards.${form.kind}.label`) : form.name.trim();
  return (
    <BuilderFrame title={start.title} onBack={onDone}>
      <Grid columns={2} gap={6} stackBelow="medium">
        <Stack gap={4}>
          {start.notice === null ? null : <Text variant="secondary">{start.notice}</Text>}
          <StartCard section={section} template={builder.template} onTemplate={start.promotionId === null ? builder.applyTemplate : null} />
          <RewardSection {...section} />
          <WhoSection section={section} stakes={names.stakes} tiers={names.tiers} />
          <WhenSection section={section} />
          <LimitsSection section={section} />
          <WhereSection section={section} />
        </Stack>
        <Box isSticky>
          <Stack gap={4}>
            <SummaryCards title={title} core={reading.core} names={names.names} />
            <SimulationCard shown={shownOf(flow.simulation, reading.core)} isPending={flow.isSimulating}
              onSimulate={() => void builder.run(flow.simulate)} emptyText={t('console.promotions.simulation.hint')} />
            <Grid columns={2} gap={2}>
              <Button variant="subtle" size="compact" fullWidth isDisabled={flow.isBusy} onClick={() => void builder.run(flow.saveDraft, 'saved')}>
                {t('console.promotions.builder.saveDraft')}
              </Button>
              <Button variant="primary" size="compact" fullWidth isLoading={flow.isSubmitting}
                isDisabled={flow.isBusy || !maySubmit(flow.simulation, reading.core, actor)} onClick={() => void builder.run(flow.submit, 'submitted')}>
                {t('console.promotions.builder.submit')}
              </Button>
            </Grid>
            {builder.failure === null ? null : <ErrorMessage>{builder.failure}</ErrorMessage>}
          </Stack>
        </Box>
      </Grid>
    </BuilderFrame>
  );
}
