import type { PromotionStatus } from '@rivr/contracts/promotionModel';
import { isListedIn, usePromotionsOverview, type PromotionOverview, type PromotionsOverview } from '@rivr/db';
import type { PromotionNames } from '@rivr/domain/promotions';
import { t } from '@rivr/i18n';
import { Button, ChoiceChips, DataTable, ErrorMessage, Screen, Stack } from '@rivr/ui';
import { useState } from 'react';
import { usePauseResume } from '../hooks/usePauseResume.ts';
import { canOpen, endedColumns, listColumns } from './listColumns.tsx';

type Filter = Exclude<PromotionStatus, 'ended'> | 'all';
type View = 'current' | 'ended';

// The current list's status chips in the prototype's order, each with its count; ended promotions have their own tab.
const FILTERS: readonly Filter[] = ['all', 'live', 'scheduled', 'awaiting_approval', 'paused', 'draft'];

const labelOf = (filter: Filter) => (filter === 'all' ? t('console.promotions.list.all') : t(`console.promotions.statuses.${filter}`));

interface PromotionListProps {
  venueId: string;
  names: PromotionNames;
  /** Opens a promotion's builder or approver view by its id, or the builder for a new one. */
  onOpen: (promotionId: string | 'new') => void;
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

/** Current and ended promotions apart (owner, 8 Nov): the tabs, with how many each holds. */
function ViewTabs({ view, current, ended, onChange }: { view: View; current: number; ended: number; onChange: (view: View) => void }) {
  return (
    <ChoiceChips label={t('console.promotions.list.views.label')} isLabelVisuallyHidden mode="one" look="tabs" selected={[view]}
      options={[{ value: 'current', label: t('console.promotions.list.views.current'), count: current },
        { value: 'ended', label: t('console.promotions.list.views.ended'), count: ended }]}
      onChange={([picked]) => onChange(picked === 'ended' ? 'ended' : 'current')} />
  );
}

/** The tabs, the chips and the table once the list has come. */
function Listed({ venueId, names, onOpen, overview }: PromotionListProps & { overview: PromotionsOverview }) {
  const [view, setView] = useState<View>('current');
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
      <ViewTabs view={view} current={current.length} ended={ended.length} onChange={setView} />
      {isEnded ? null : <StatusChips current={current} filter={filter} onChange={setFilter} />}
      {toggles.failure === null ? null : <ErrorMessage>{t(`console.promotions.failures.${toggles.failure}`)}</ErrorMessage>}
      <DataTable label={t('console.promotions.list.label')} rowKey={(promotion) => promotion.id} density="comfortable" narrowLayout="scroll"
        columns={isEnded ? endedColumns(names, steps) : listColumns(names, steps)} onRowOpen={open}
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
