import type { PromotionStatus } from '@rivr/contracts/promotionModel';
import type { PromotionOverview } from '@rivr/db';
import { whoAndWhen, type PromotionNames } from '@rivr/domain/promotions';
import { formatDate, t } from '@rivr/i18n';
import { Button, ConfirmButton, DotStatus, Inline, Number as Count, Stack, Text, type DataTableColumn, type DotStatusTone } from '@rivr/ui';

// Awaiting approval is the one that needs someone: gold. Running ones are cream; the rest faint (console v3, DotStatus).
const TONE: Readonly<Record<PromotionStatus, DotStatusTone>> = {
  live: 'active', scheduled: 'active', awaiting_approval: 'needsYou', paused: 'inactive', draft: 'inactive', ended: 'inactive',
};

// A grant this week counts only for a promotion that has run: one waiting or scheduled shows nothing.
const HAS_RUN: readonly PromotionStatus[] = ['live', 'paused', 'ended'];

/** Whether its next version waits for approval, or it waits itself (a promotion in versions; a rule's waits for no one now). */
export function isWaiting(promotion: PromotionOverview): boolean {
  return !promotion.isLegacy && (promotion.openStatus === 'awaiting_approval' || promotion.status === 'awaiting_approval');
}

/** Whether Edit or Review opens it: a promotion in versions with an open version, or one running that a new version changes. */
export function canOpen(promotion: PromotionOverview): boolean {
  if (promotion.isLegacy) return false;
  return promotion.openVersionId !== null || (promotion.currentVersionId !== null && promotion.status !== 'ended');
}

// End (owner, 8 Nov): a version that is scheduled, live or paused (end_promotion_version); a rule's promotion only pauses.
const ENDS: readonly PromotionStatus[] = ['scheduled', 'live', 'paused'];

/**
 * Whether End shows: a promotion in versions whose current version is scheduled, live or paused, with no new version open.
 * A waiting or draft version would outlive the end and, approved, run it again; it is approved or rejected first.
 */
export function canEnd(promotion: PromotionOverview): boolean {
  return !promotion.isLegacy && promotion.currentVersionId !== null && promotion.openVersionId === null && ENDS.includes(promotion.status);
}

const capitalised = (words: string) => words.charAt(0).toUpperCase() + words.slice(1);

/** Who it is for and when it runs, from its terms; a promotion run by its rule says only when, in its own words. */
function whoWhen(promotion: PromotionOverview, names: PromotionNames): { who: string; when: string } {
  if (promotion.terms === null) return { who: '', when: promotion.runs ?? '' };
  const words = whoAndWhen(promotion.terms, names);
  return { who: capitalised(words.who), when: capitalised(words.when) };
}

/**
 * Under the status: a new version beside the running one, a draft sent back, or a promotion still run by its old rule
 * (decision 0491). An ended one says nothing more: the retired word-only cards are history (decision 0498).
 */
function statusNote(promotion: PromotionOverview): string | null {
  if (promotion.isLegacy) return promotion.status === 'ended' ? null : t('console.promotions.list.byRule');
  if (promotion.currentVersionId !== null && promotion.openStatus !== null) {
    return t(promotion.openStatus === 'awaiting_approval' ? 'console.promotions.list.newVersionWaits' : 'console.promotions.list.newVersionDraft');
  }
  return promotion.status === 'draft' && promotion.rejectedReason !== null ? t('console.promotions.list.sentBack') : null;
}

function StatusCell({ promotion }: { promotion: PromotionOverview }) {
  const note = statusNote(promotion);
  return (
    <Stack gap={1}>
      <DotStatus tone={TONE[promotion.status]} label={t(`console.promotions.statuses.${promotion.status}`)} />
      {note === null ? null : <Text variant="secondary" tone="muted">{note}</Text>}
    </Stack>
  );
}

/** What the list's buttons do: pause or resume a running promotion, end one, and open one to edit or review. */
export interface RowSteps {
  readonly isBusy: boolean;
  readonly pause: (promotion: PromotionOverview) => void;
  readonly resume: (promotion: PromotionOverview) => void;
  readonly end: (promotion: PromotionOverview) => void;
  readonly open: (promotion: PromotionOverview) => void;
}

function RowActions({ promotion, steps }: { promotion: PromotionOverview; steps: RowSteps }) {
  const name = promotion.name;
  const isLive = promotion.status === 'live';
  const opens = isWaiting(promotion) ? 'review' : 'edit';
  return (
    <Inline gap={2} justify="end">
      {isLive || promotion.status === 'paused' ? (
        <Button variant="subtle" size="small" isDisabled={steps.isBusy} onClick={() => (isLive ? steps.pause(promotion) : steps.resume(promotion))}
          aria-label={t(isLive ? 'console.promotions.list.pauseNamed' : 'console.promotions.list.resumeNamed', { name })}>
          {t(isLive ? 'console.promotions.list.pause' : 'console.promotions.list.resume')}
        </Button>
      ) : null}
      {canOpen(promotion) ? (
        <Button variant="subtle" size="small" onClick={() => steps.open(promotion)} aria-label={t(`console.promotions.list.${opens}Named`, { name })}>
          {t(`console.promotions.list.${opens}`)}
        </Button>
      ) : null}
      {canEnd(promotion) ? (
        <ConfirmButton label={t('console.promotions.list.end')} name={t('console.promotions.list.endNamed', { name })} variant="subtle" size="small"
          confirm={t('console.promotions.list.confirmEnd', { name })} isBusy={steps.isBusy} onConfirm={() => steps.end(promotion)} />
      ) : null}
    </Inline>
  );
}

/**
 * The list's columns, as the prototype has them: the promotion with what it gives in gold, who, when, the grants this
 * club week, the status as a dot and its words, and Pause or Resume and Edit or Review.
 */
export function listColumns(names: PromotionNames, steps: RowSteps): DataTableColumn<PromotionOverview>[] {
  return [
    {
      key: 'promotion', header: t('console.promotions.list.columns.promotion'), priority: 'primary', isWide: true, filter: 'text',
      filterValue: (promotion) => promotion.name,
      cell: (promotion) => (
        <Stack gap={1}>
          <Text as="span" variant="row" weight="medium">{promotion.name}</Text>
          {promotion.detail === null ? null : <Text as="span" variant="secondary" tone="accent">{promotion.detail}</Text>}
        </Stack>
      ),
    },
    {
      key: 'who', header: t('console.promotions.list.columns.who'), cell: (promotion) => whoWhen(promotion, names).who, filter: 'choice',
      filterValue: (promotion) => whoWhen(promotion, names).who,
    },
    {
      key: 'when', header: t('console.promotions.list.columns.when'), cell: (promotion) => whoWhen(promotion, names).when, filter: 'choice',
      filterValue: (promotion) => whoWhen(promotion, names).when,
    },
    {
      key: 'given', header: t('console.promotions.list.columns.given'), align: 'end', priority: 'optional',
      cell: (promotion) => (HAS_RUN.includes(promotion.status) ? <Count value={promotion.givenThisWeek} size="small" /> : null),
    },
    { key: 'status', header: t('console.promotions.list.columns.status'), cell: (promotion) => <StatusCell promotion={promotion} /> },
    { key: 'actions', header: '', cell: (promotion) => <RowActions promotion={promotion} steps={steps} /> },
  ];
}

/** The ended promotions' columns (owner, 8 Nov): the promotion with what it gave, who and when it was for, and the day it ended. */
export function endedColumns(names: PromotionNames, steps: RowSteps): DataTableColumn<PromotionOverview>[] {
  const [promotion, who, when] = listColumns(names, steps);
  return [
    ...[promotion, who, when].filter((column) => column !== undefined),
    {
      key: 'ended', header: t('console.promotions.list.columns.ended'), sortValue: (row) => row.endedAt ?? '',
      cell: (row) => (row.endedAt === null ? '' : formatDate(new Date(row.endedAt))),
    },
  ];
}
