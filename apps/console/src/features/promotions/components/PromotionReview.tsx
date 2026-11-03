import type { ApproverView, PromotionVersionView } from '@rivr/db';
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
    <BuilderFrame title={t('console.promotions.review.title', { name })} description={submittedLine(waiting)} onBack={onDone}>
      <Grid columns={2} gap={6} stackBelow="medium">
        <Stack gap={4}>
          <Text variant="secondary">{changesLine(view)}</Text>
          <ReadOnlySections waiting={waiting} changed={changed} names={names} />
        </Stack>
        <Box isSticky>
          <Stack gap={4}>
            <SummaryCards title={name} core={waiting.terms} names={names.names}
              before={live?.terms ? { label: t('console.promotions.review.runningNow', { version: live.version }), core: live.terms } : undefined} />
            <SimulationCard emptyText={t('console.promotions.simulation.notStored')}
              shown={waiting.simulation === null || waiting.terms === null ? null : { kind: waiting.terms.reward.kind, result: waiting.simulation, period: null }} />
            <DecisionPanel venueId={venueId} waiting={waiting} actor={actor} onDone={onDone} />
          </Stack>
        </Box>
      </Grid>
    </BuilderFrame>
  );
}
