import { useFeedbackCounts, useFeedbackPage, useStaffVenue, type FeedbackItem, type FeedbackListName } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, Inline, LoadState, Screen, Stack, Tabs, Text } from '@rivr/ui';
import { FeedbackCard } from './FeedbackCard.tsx';
import { OpenTickets } from './OpenTickets.tsx';

const TABS = ['open', 'resolved', 'all'] as const;
type FeedbackTab = (typeof TABS)[number];

/** Where a screen's tab sends the address: `/feedback?tab=resolved`. */
export interface TabbedProps {
  readonly tab: string | undefined;
  readonly onNavigate: (href: string) => void;
}

/** The tab's cards, or its one line when it has none. */
function Cards({ items, emptyText }: { items: readonly FeedbackItem[]; emptyText: string }) {
  if (items.length === 0) return <Text tone="muted">{emptyText}</Text>;
  return <Stack gap={3}>{items.map((item) => <FeedbackCard key={item.id} item={item} />)}</Stack>;
}

/** A list read a page at a time, with Show more while there is another (F-024). */
function PagedList({ venueId, list, emptyText }: { venueId: string; list: FeedbackListName; emptyText: string }) {
  const page = useFeedbackPage(venueId, list);
  if (page.isError) return <LoadState isError onRetry={() => void page.refetch()} />;
  if (page.data === undefined) return <LoadState />;
  return (
    <Stack gap={3}>
      <Cards items={page.data.pages.flat()} emptyText={emptyText} />
      {page.hasNextPage ? (
        <Inline><Button variant="subtle" isLoading={page.isFetchingNextPage} onClick={() => void page.fetchNextPage()}>{t('console.feedback.more')}</Button></Inline>
      ) : null}
    </Stack>
  );
}

/** The tabs with each list's count from the server (F-024), and the list the address names. */
export function FeedbackList({ venueId, tab, onNavigate }: TabbedProps & { venueId: string }) {
  const counts = useFeedbackCounts(venueId);
  const title = t('console.feedback.title');
  if (counts.isPending) return <Screen title={title} status="loading" loadingLook="rows" />;
  if (counts.data === undefined) return <Screen title={title} status="error" onRetry={() => void counts.refetch()} />;
  const current: FeedbackTab = TABS.find((one) => one === tab) ?? 'open';
  const count = { open: counts.data.open, resolved: counts.data.resolved, all: counts.data.other };
  return (
    <Screen title={title}>
      <Stack gap={6}>
        <Tabs label={title} current={current} onNavigate={onNavigate}
          tabs={TABS.map((id) => ({ id, label: t(`console.feedback.tabs.${id}`, { count: String(count[id]) }), href: `/feedback?tab=${id}` }))} />
        {current === 'open' ? <OpenTickets venueId={venueId} onNavigate={onNavigate} /> : null}
        {current === 'resolved' ? <PagedList key="resolved" venueId={venueId} list="resolved" emptyText={t('console.feedback.noneResolved')} /> : null}
        {current === 'all' ? <PagedList key="all" venueId={venueId} list="other" emptyText={t('console.feedback.noneOther')} /> : null}
      </Stack>
    </Screen>
  );
}

/**
 * Feedback (#160, decision 0165), for the General Manager (feedback.manage): the open tickets (anything with a written
 * note, the owner, 9 Nov), each resolved with what was done and kept with the staff member's name; on Resolved, the tickets
 * resolved in the last 90 days; and on Other, the ratings of those days that never were tickets (F-024).
 */
export function FeedbackScreen({ tab, onNavigate }: TabbedProps) {
  const staff = useStaffVenue();
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  if (!staff.venue.permissions.includes('feedback.manage')) {
    return <Screen title={t('console.feedback.title')} status="error" errorText={t('console.feedback.notAllowed')} />;
  }
  return <FeedbackList venueId={staff.venue.venueId} tab={tab} onNavigate={onNavigate} />;
}
