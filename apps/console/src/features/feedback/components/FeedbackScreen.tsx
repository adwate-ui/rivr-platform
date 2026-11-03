import { useStaffVenue, useVenueFeedback, type FeedbackItem } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Screen, Stack, Tabs, Text } from '@rivr/ui';
import { FeedbackCard } from './FeedbackCard.tsx';

const TABS = ['open', 'resolved'] as const;
type FeedbackTab = (typeof TABS)[number];

/** Where a screen's tab sends the address: `/feedback?tab=resolved`. */
export interface TabbedProps {
  readonly tab: string | undefined;
  readonly onNavigate: (href: string) => void;
}

/** An open ticket: a rating of 3 or below, or a note from the app, not yet resolved. */
const isOpen = (item: FeedbackItem) => item.isTicket && item.resolvedAt === null;

/** The tab's cards, newest first, or its one line when it has none. */
function Cards({ venueId, items, emptyText }: { venueId: string; items: readonly FeedbackItem[]; emptyText: string }) {
  if (items.length === 0) return <Text tone="muted">{emptyText}</Text>;
  return <Stack gap={3}>{items.map((item) => <FeedbackCard key={item.id} venueId={venueId} item={item} />)}</Stack>;
}

/** The open tickets or, on Resolved, everything else of the last 90 days, under the two tabs with their counts (console v3). */
export function FeedbackList({ venueId, tab, onNavigate }: TabbedProps & { venueId: string }) {
  const list = useVenueFeedback(venueId);
  const title = t('console.feedback.title');
  if (list.isPending) return <Screen title={title} status="loading" loadingLook="rows" />;
  if (list.data === undefined) return <Screen title={title} status="error" onRetry={() => void list.refetch()} />;
  const current: FeedbackTab = TABS.find((one) => one === tab) ?? 'open';
  const open = list.data.filter(isOpen);
  const resolved = list.data.filter((item) => !isOpen(item));
  const counts = { open: open.length, resolved: resolved.length };
  return (
    <Screen title={title}>
      <Stack gap={6}>
        <Tabs label={title} current={current} onNavigate={onNavigate}
          tabs={TABS.map((id) => ({ id, label: t(`console.feedback.tabs.${id}`, { count: String(counts[id]) }), href: `/feedback?tab=${id}` }))} />
        {current === 'open'
          ? <Cards venueId={venueId} items={open} emptyText={t('console.feedback.noneOpen')} />
          : <Cards venueId={venueId} items={resolved} emptyText={t('console.feedback.noneResolved')} />}
      </Stack>
    </Screen>
  );
}

/**
 * Feedback (#160, decision 0165), for the General Manager (feedback.manage): the open tickets (a rating of 3 or below, or
 * a note from the app), each resolved with what was done and kept with the staff member's name; and on Resolved, everything
 * else from the last 90 days (console v3).
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
