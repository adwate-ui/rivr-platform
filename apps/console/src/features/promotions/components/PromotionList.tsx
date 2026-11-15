import type { PromotionStatus } from '@rivr/contracts/promotionModel';
import { isListedIn, usePromotionsOverview, useStaffQueueCounts, type PromotionOverview, type PromotionsOverview } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, ChoiceChips, DataTable, ErrorMessage, Screen, Stack, Tabs } from '@rivr/ui';
import { useState } from 'react';
import { usePauseResume } from '../hooks/usePauseResume.ts';
import { BonusApprovals } from './BonusApprovals.tsx';
import { HighHandRecord, hasRecord } from './HighHandRecord.tsx';
import { canOpen, endedColumns, listColumns } from './listColumns.tsx';
import type { PromotionNames } from './promotionWords.ts';

type Filter = Exclude<PromotionStatus, 'ended'> | 'all';
const TABS = ['current', 'ended', 'bonus'] as const;
type View = (typeof TABS)[number];

// The current list's status chips in the prototype's order, each with its count; ended promotions have their own tab.
const FILTERS: readonly Filter[] = ['all', 'live', 'scheduled', 'awaiting_approval', 'paused', 'draft'];

// The Ended tab opens on the promotion that ended last.
const LATEST_ENDED_FIRST = { key: 'ended', direction: 'descending' } as const;

// Live first, then what is coming, what waits, what is stopped and the drafts, as the chips have them (audit F-104).
const byStatus = (one: PromotionOverview, other: PromotionOverview) =>
  FILTERS.findIndex((filter) => filter === one.status) - FILTERS.findIndex((filter) => filter === other.status);

const labelOf = (filter: Filter) => (filter === 'all' ? t('console.promotions.list.all') : t(`console.promotions.statuses.${filter}`));

interface PromotionListProps {
  venueId: string;
  names: PromotionNames;
  /** Opens a promotion's builder or approver view by its id, or the builder for a new one. */
  onOpen: (promotionId: string | 'new') => void;
  /** The tab in the address: Current, Ended with `?tab=ended` (owner, 8 Nov) or To approve with `?tab=bonus`; and how a tab opens. */
  tab: string | undefined;
  onNavigate: (href: string) => void;
  /** Opens the Live floor's Log a high hand; none for staff who may not log one. */
  onLogHighHand?: (() => void) | undefined;
  /** A super admin's (promotions.approve): the Bonus to approve is theirs (decision 0670). */
  canApprove: boolean;
}

/** The status chips over the current promotions: All, then each status, with how many each lists. */
function StatusChips({ current, filter, onChange }: { current: readonly PromotionOverview[]; filter: Filter; onChange: (filter: Filter) => void }) {
  const countOf = (value: Filter) => (value === 'all' ? current.length : current.filter((promotion) => isListedIn(promotion, value)).length);
  return (
    <ChoiceChips label={t('console.promotions.list.filter')} isLabelVisuallyHidden isOneRow mode="one" look="subtle" selected={[filter]}
      options={FILTERS.map((value) => ({ value, label: labelOf(value), count: countOf(value) }))}
      onChange={(picked) => onChange(FILTERS.find((value) => value === picked[0]) ?? 'all')} />
  );
}

/**
 * Current and ended promotions apart (owner, 8 Nov), and for a super admin the Bonus waiting for them (decision 0670): the tabs
 * in the address, each with how many it holds.
 */
function ViewTabs({ view, counts, canApprove, onNavigate }: { view: View; counts: Readonly<Record<View, number>>; canApprove: boolean; onNavigate: (href: string) => void }) {
  return (
    <Tabs label={t('console.promotions.title')} current={view} onNavigate={onNavigate}
      tabs={TABS.filter((id) => canApprove || id !== 'bonus').map((id) => ({ id, label: t(`console.promotions.list.tabs.${id}`, { count: String(counts[id]) }),
        href: id === 'current' ? '/promotions' : `/promotions?tab=${id}` }))} />
  );
}

interface PromotionsShownProps extends Pick<PromotionListProps, 'venueId' | 'names' | 'onOpen' | 'onLogHighHand'> {
  view: Exclude<View, 'bonus'>;
  overview: PromotionsOverview;
  current: readonly PromotionOverview[];
  ended: readonly PromotionOverview[];
  exportIn: HTMLElement | null;
}

/**
 * The current promotions with their status chips, or the ended ones: each with Pause or Resume, Edit or Review, and End; a
 * high hand's record opens beside the list.
 */
function PromotionsShown({ venueId, names, onOpen, onLogHighHand, view, overview, current, ended, exportIn }: PromotionsShownProps) {
  const [filter, setFilter] = useState<Filter>('all');
  // A high hand's record, open beside the list (redesign RD-23), read from the list so a pause or a payout shows in it.
  const [recordId, setRecordId] = useState<string | null>(null);
  const record = overview.promotions.find((promotion) => promotion.id === recordId && hasRecord(promotion));
  const toggles = usePauseResume(venueId);
  const open = (promotion: PromotionOverview) => {
    if (canOpen(promotion)) onOpen(promotion.id);
  };
  const openRow = (promotion: PromotionOverview) => (hasRecord(promotion) ? setRecordId(promotion.id) : open(promotion));
  const steps = { isBusy: toggles.isBusy, pause: toggles.pause, resume: toggles.resume, end: toggles.end, open };
  const isEnded = view === 'ended';
  return (
    <>
      {isEnded ? null : <StatusChips current={current} filter={filter} onChange={setFilter} />}
      {toggles.failure === null ? null : <ErrorMessage>{t(`console.promotions.failures.${toggles.failure}`)}</ErrorMessage>}
      <DataTable exportIn={exportIn} label={t(isEnded ? 'console.promotions.list.endedLabel' : 'console.promotions.list.label')} rowKey={(promotion) => promotion.id} density="comfortable" narrowLayout="scroll"
        columns={isEnded ? endedColumns(names, steps) : listColumns(names, steps)} onRowOpen={openRow} key={view}
        {...(isEnded ? { initialSort: LATEST_ENDED_FIRST } : {})}
        rows={isEnded ? ended : current.filter((promotion) => filter === 'all' || isListedIn(promotion, filter))}
        emptyText={t(isEnded ? 'console.promotions.list.noneEnded' : 'console.promotions.list.empty')} />
      {record === undefined ? null : (
        <HighHandRecord venueId={venueId} promotion={record} names={names} steps={steps} onLog={onLogHighHand} onClose={() => setRecordId(null)} />
      )}
    </>
  );
}

/** The tabs, then the promotions or, on a super admin's own tab, the Bonus waiting for approval, once the list has come. */
function Listed({ venueId, names, onOpen, tab, onNavigate, onLogHighHand, canApprove, overview, exportIn }: PromotionListProps & { overview: PromotionsOverview; exportIn: HTMLElement | null }) {
  const view: View = TABS.find((one) => one === tab && (canApprove || one !== 'bonus')) ?? 'current';
  const waiting = useStaffQueueCounts(venueId).data?.['bonusApprovals'] ?? 0;
  const current = overview.promotions.filter((promotion) => promotion.status !== 'ended').sort(byStatus);
  const ended = overview.promotions.filter((promotion) => promotion.status === 'ended');
  return (
    <Stack gap={4}>
      <ViewTabs view={view} counts={{ current: current.length, ended: ended.length, bonus: waiting }} canApprove={canApprove} onNavigate={onNavigate} />
      {view === 'bonus'
        ? <BonusApprovals venueId={venueId} onNavigate={onNavigate} exportIn={exportIn} />
        : <PromotionsShown venueId={venueId} names={names} onOpen={onOpen} onLogHighHand={onLogHighHand} view={view} overview={overview}
            current={current} ended={ended} exportIn={exportIn} />}
    </Stack>
  );
}

/**
 * Promotions (console v3, phase 7): current promotions with a chip for each status and its count, then a row each with what
 * it gives, who, when, the grants this club week and its status; Pause or Resume, Edit or Review, and End. Ended ones have
 * their own tab, with the day each ended (owner, 8 Nov); a super admin's has the Bonus to approve (decision 0670). New
 * promotion opens the builder.
 */
export function PromotionList(props: PromotionListProps) {
  const overview = usePromotionsOverview(props.venueId);
  const title = t('console.promotions.title');
  const action = <Button variant="primary" size="compact" onClick={() => props.onOpen('new')}>{t('console.promotions.newPromotion')}</Button>;
  // A table alone on a screen has its Export beside the title (audit F-207).
  const [exportIn, setExportIn] = useState<HTMLElement | null>(null);
  if (overview.data === undefined) {
    if (overview.isError) return <Screen title={title} actions={action} status="error" onRetry={() => void overview.refetch()} />;
    return <Screen title={title} actions={action} status="loading" loadingLook="rows" />;
  }
  return (
    <Screen title={title} actions={action} onActionsSlot={setExportIn}>
      <Listed {...props} overview={overview.data} exportIn={exportIn} />
    </Screen>
  );
}
