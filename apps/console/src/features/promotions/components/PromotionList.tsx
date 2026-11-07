import type { PromotionStatus } from '@rivr/contracts/promotionModel';
import { isListedIn, usePromotionsOverview, type PromotionOverview, type PromotionsOverview } from '@rivr/db';
import type { PromotionNames } from '@rivr/domain/promotions';
import { t } from '@rivr/i18n';
import { Button, ChoiceChips, DataTable, ErrorMessage, Screen, Stack, Tabs } from '@rivr/ui';
import { useState } from 'react';
import { usePauseResume } from '../hooks/usePauseResume.ts';
import { canOpen, endedColumns, listColumns } from './listColumns.tsx';

type Filter = Exclude<PromotionStatus, 'ended'> | 'all';
const TABS = ['current', 'ended'] as const;
type View = (typeof TABS)[number];

// The current list's status chips in the prototype's order, each with its count; ended promotions have their own tab.
const FILTERS: readonly Filter[] = ['all', 'live', 'scheduled', 'awaiting_approval', 'paused', 'draft'];

// The Ended tab opens on the promotion that ended last.
const LATEST_ENDED_FIRST = { key: 'ended', direction: 'descending' } as const;

const labelOf = (filter: Filter) => (filter === 'all' ? t('console.promotions.list.all') : t(`console.promotions.statuses.${filter}`));

interface PromotionListProps {
  venueId: string;
  names: PromotionNames;
  /** Opens a promotion's builder or approver view by its id, or the builder for a new one. */
  onOpen: (promotionId: string | 'new') => void;
  /** The tab in the address: Current, or Ended with `?tab=ended` (owner, 8 Nov); and how a tab opens. */
  tab: string | undefined;
  onNavigate: (href: string) => void;
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

/** Current and ended promotions apart (owner, 8 Nov): the tabs in the address, each with how many it holds. */
function ViewTabs({ view, counts, onNavigate }: { view: View; counts: Readonly<Record<View, number>>; onNavigate: (href: string) => void }) {
  return (
    <Tabs label={t('console.promotions.title')} current={view} onNavigate={onNavigate}
      tabs={TABS.map((id) => ({ id, label: t(`console.promotions.list.tabs.${id}`, { count: String(counts[id]) }),
        href: id === 'current' ? '/promotions' : `/promotions?tab=${id}` }))} />
  );
}

/** The tabs, the chips and the table once the list has come. */
function Listed({ venueId, names, onOpen, tab, onNavigate, overview }: PromotionListProps & { overview: PromotionsOverview }) {
  const view: View = TABS.find((one) => one === tab) ?? 'current';
  const [filter, setFilter] = useState<Filter>('all');
  const toggles = usePauseResume(venueId);
  const open = (promotion: PromotionOverview) => {
    if (canOpen(promotion)) onOpen(promotion.id);
  };
  const steps = { isBusy: toggles.isBusy, pause: toggles.pause, resume: toggles.resume, end: toggles.end, open };
  const current = overview.promotions.filter((promotion) => promotion.status !== 'ended');
  const ended = overview.promotions.filter((promotion) => promotion.status === 'ended');
  const isEnded = view === 'ended';
  return (
    <Stack gap={4}>
      <ViewTabs view={view} counts={{ current: current.length, ended: ended.length }} onNavigate={onNavigate} />
      {isEnded ? null : <StatusChips current={current} filter={filter} onChange={setFilter} />}
      {toggles.failure === null ? null : <ErrorMessage>{t(`console.promotions.failures.${toggles.failure}`)}</ErrorMessage>}
      <DataTable label={t('console.promotions.list.label')} rowKey={(promotion) => promotion.id} density="comfortable" narrowLayout="scroll"
        columns={isEnded ? endedColumns(names, steps) : listColumns(names, steps)} onRowOpen={open} key={view}
        {...(isEnded ? { initialSort: LATEST_ENDED_FIRST } : {})}
        rows={isEnded ? ended : current.filter((promotion) => filter === 'all' || isListedIn(promotion, filter))}
        emptyText={t(isEnded ? 'console.promotions.list.noneEnded' : 'console.promotions.list.empty')} />
    </Stack>
  );
}

/**
 * Promotions (console v3, phase 7): current promotions with a chip for each status and its count, then a row each with what
 * it gives, who, when, the grants this club week and its status; Pause or Resume, Edit or Review, and End. Ended ones have
 * their own tab, with the day each ended (owner, 8 Nov). New promotion opens the builder.
 */
export function PromotionList(props: PromotionListProps) {
  const overview = usePromotionsOverview(props.venueId);
  const title = t('console.promotions.title');
  const action = <Button variant="primary" size="compact" onClick={() => props.onOpen('new')}>{t('console.promotions.newPromotion')}</Button>;
  if (overview.data === undefined) {
    if (overview.isError) return <Screen title={title} actions={action} status="error" onRetry={() => void overview.refetch()} />;
    return <Screen title={title} actions={action} status="loading" loadingLook="rows" />;
  }
  return (
    <Screen title={title} actions={action}>
      <Listed {...props} overview={overview.data} />
    </Screen>
  );
}
