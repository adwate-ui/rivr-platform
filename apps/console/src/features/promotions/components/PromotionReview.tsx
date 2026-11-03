import { useLastWeekReplay, type ApproverView, type PromotionVersionView } from '@rivr/db';
import type { Actor, TermsPart } from '@rivr/domain/promotions';
import { formatDayTime, t } from '@rivr/i18n';
import { Box, ErrorMessage, Grid, Stack, Text } from '@rivr/ui';
import type { BuilderNames } from '../hooks/useBuilderNames.ts';
import type { SectionProps } from './BuilderCard.tsx';
import { BuilderFrame, StartCard } from './BuilderFrame.tsx';
import { formFromTerms } from './builderForm.ts';
import { DecisionPanel } from './DecisionPanel.tsx';
import { LimitsSection, WhereSection } from './LimitsWhereSections.tsx';
import { RewardSection } from './RewardSection.tsx';
import { SimulationCard } from './SimulationCard.tsx';
import { SummaryCards } from './SummaryCards.tsx';
import { WhenSection, WhoSection } from './WhoWhenSections.tsx';

interface PromotionReviewProps {
  venueId: string;
  names: BuilderNames;
  actor: Actor;
  /** The waiting version, the running one it would replace, and the parts it changes (`approverViewOf`). */
  view: ApproverView & { readonly waiting: PromotionVersionView };
  onDone: () => void;
}

/** Who submitted the version and when, under the title. */
function submittedLine(waiting: PromotionVersionView): string {
  if (waiting.author === null || waiting.submittedAt === null) return t('console.promotions.review.waitingVersion', { version: waiting.version });
  return t('console.promotions.review.submittedBy', { version: waiting.version, name: waiting.author, time: formatDayTime(new Date(waiting.submittedAt)) });
}

/** What it changes against the running version, in the builder's order; or that it is a new promotion. */
function changesLine({ live, changed }: ApproverView): string {
  if (live === null) return t('console.promotions.review.newPromotion');
  if (changed.length === 0) return t('console.promotions.review.noChanges', { version: live.version });
  const parts = changed.map((part) => t(`console.promotions.review.parts.${part}`)).join(', ');
  return t('console.promotions.review.changes', { version: live.version, parts });
}

/**
 * Last week replayed afresh for the approver (decision 0465), not the figures stored with the version, which its author's
 * browser sent; a replay that fails offers Simulate to run it again.
 */
function FreshSimulation({ waiting }: { waiting: PromotionVersionView }) {
  const replay = useLastWeekReplay(waiting.id, waiting.terms);
  if (waiting.terms === null || replay.data === undefined) {
    const isFailed = replay.isError || waiting.terms === null;
    const retry = replay.isError && waiting.terms !== null ? () => void replay.refetch() : undefined;
    return <SimulationCard shown={null} emptyText={t(isFailed ? 'console.promotions.simulation.failed' : 'console.promotions.simulation.replaying')} onSimulate={retry} />;
  }
  const shown = { kind: waiting.terms.reward.kind, result: replay.data, period: { from: replay.data.from, to: replay.data.to } };
  return <SimulationCard shown={shown} emptyText={t('console.promotions.simulation.replaying')} />;
}

/** The five sections as the builder shows them, read only, each marked where the waiting version changes it. */
function ReadOnlySections({ waiting, changed, names }: { waiting: PromotionVersionView; changed: ReadonlySet<TermsPart>; names: BuilderNames }) {
  if (waiting.terms === null) return <ErrorMessage>{t('console.promotions.review.unreadable')}</ErrorMessage>;
  const section: SectionProps = { form: formFromTerms(waiting.terms), errors: new Set(), onChange: () => undefined, isReadOnly: true };
  const marked = (...parts: TermsPart[]): SectionProps => ({ ...section, isChanged: parts.some((part) => changed.has(part)) });
  // Where it shows holds the channels, the rules and the card's link.
  const sections = {
    reward: marked('reward'), who: marked('eligibility'), when: marked('schedule'), limits: marked('limits'), where: marked('channels', 'rulesText', 'link'),
  };
  return (
    <>
      <StartCard section={section} template={null} onTemplate={null} />
      <RewardSection {...sections.reward} />
      <WhoSection section={sections.who} stakes={names.stakes} tiers={names.tiers} />
      <WhenSection section={sections.when} />
      <LimitsSection section={sections.limits} />
      <WhereSection section={sections.where} />
    </>
  );
}

/**
 * The approver's view (console v3, phase 7): the builder read only, each part the waiting version changes marked against
 * the running version, both in one line, the simulation stored with it, and Approve or Reject (four eyes, decision 0437).
 */
export function PromotionReview({ venueId, names, actor, view, onDone }: PromotionReviewProps) {
  const { live, waiting } = view;
  // A new promotion changes every part: nothing is marked, as nothing runs to differ from.
  const changed = new Set(live === null ? [] : view.changed);
  const name = waiting.terms?.name ?? '';
  return (
    <BuilderFrame title={t('console.promotions.review.title', { name })} onBack={onDone}>
      <Grid columns={2} gap={6} stackBelow="medium">
        <Stack gap={4}>
          <Stack gap={1}>
            <Text variant="secondary" tone="muted">{submittedLine(waiting)}</Text>
            <Text variant="secondary">{changesLine(view)}</Text>
          </Stack>
          <ReadOnlySections waiting={waiting} changed={changed} names={names} />
        </Stack>
        <Box isSticky>
          <Stack gap={4}>
            <SummaryCards title={name} core={waiting.terms} names={names.names}
              before={live?.terms ? { label: t('console.promotions.review.runningNow', { version: live.version }), core: live.terms } : undefined} />
            <FreshSimulation waiting={waiting} />
            <DecisionPanel venueId={venueId} waiting={waiting} actor={actor} onDone={onDone} />
          </Stack>
        </Box>
      </Grid>
    </BuilderFrame>
  );
}
