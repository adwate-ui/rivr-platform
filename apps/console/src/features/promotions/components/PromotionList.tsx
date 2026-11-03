import type { PromotionStatus } from '@rivr/contracts/promotionModel';
import { isListedIn, usePromotionsOverview, type PromotionOverview, type PromotionsOverview } from '@rivr/db';
import type { PromotionNames } from '@rivr/domain/promotions';
import { t } from '@rivr/i18n';
import { Button, ChoiceChips, DataTable, ErrorMessage, Screen, Stack } from '@rivr/ui';
import { useState } from 'react';
import { usePauseResume } from '../hooks/usePauseResume.ts';
import { canOpen, listColumns } from './listColumns.tsx';

type Filter = PromotionStatus | 'all';

// The filter chips in the prototype's order, each with its count.
const FILTERS: readonly Filter[] = ['all', 'live', 'scheduled', 'awaiting_approval', 'paused', 'draft', 'ended'];

const labelOf = (filter: Filter) => (filter === 'all' ? t('console.promotions.list.all') : t(`console.promotions.statuses.${filter}`));

interface PromotionListProps {
  venueId: string;
  names: PromotionNames;
  /** Opens a promotion's builder or approver view by its id, or the builder for a new one. */
  onOpen: (promotionId: string | 'new') => void;
}

/** The chips and the table once the list has come. */
function Listed({ venueId, names, onOpen, overview }: PromotionListProps & { overview: PromotionsOverview }) {
  const [filter, setFilter] = useState<Filter>('all');
  const toggles = usePauseResume(venueId);
  const open = (promotion: PromotionOverview) => {
    if (canOpen(promotion)) onOpen(promotion.id);
  };
  const steps = { isBusy: toggles.isBusy, pause: toggles.pause, resume: toggles.resume, open };
  const rows = overview.promotions.filter((promotion) => filter === 'all' || isListedIn(promotion, filter));
  return (
    <Stack gap={4}>
      <ChoiceChips label={t('console.promotions.list.filter')} isLabelVisuallyHidden isOneRow mode="one" look="subtle" selected={[filter]}
        options={FILTERS.map((value) => ({ value, label: labelOf(value), count: overview.counts[value] }))}
        onChange={(picked) => setFilter(FILTERS.find((value) => value === picked[0]) ?? 'all')} />
      {toggles.failure === null ? null : <ErrorMessage>{t(`console.promotions.failures.${toggles.failure}`)}</ErrorMessage>}
      <DataTable label={t('console.promotions.list.label')} columns={listColumns(names, steps)} rows={rows} rowKey={(promotion) => promotion.id}
        emptyText={t('console.promotions.list.empty')} density="comfortable" narrowLayout="scroll" onRowOpen={open} />
    </Stack>
  );
}

/**
 * Promotions (console v3, phase 7): every promotion with a chip for each status and its count, then a row each with what it
 * gives, who, when, the grants this club week and its status; Pause or Resume, and Edit or Review. New promotion opens
 * the builder.
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
