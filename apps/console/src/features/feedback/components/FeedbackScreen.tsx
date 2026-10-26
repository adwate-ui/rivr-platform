import { useStaffVenue, useVenueFeedback, type FeedbackItem } from '@rivr/db';
import { formatDayMonth, t } from '@rivr/i18n';
import { Heading, Screen, Stack, Text } from '@rivr/ui';
import { ResolveForm } from './ResolveForm.tsx';

/**
 * Feedback (#160, decision 0165), for the General Manager (feedback.manage): the open tickets first (a
 * rating of 3 or below, or a note from the app), each resolved with what was done; then everything from
 * the last 90 days.
 */
export function FeedbackScreen() {
  const staff = useStaffVenue();
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  if (!staff.venue.permissions.includes('feedback.manage')) {
    return <Screen title={t('console.feedback.title')} status="error" errorText={t('console.feedback.notAllowed')} />;
  }
  return <FeedbackList venueId={staff.venue.venueId} />;
}

/** Who and what: a rating with its visit's day, or a note with the day it came. */
export function feedbackLine(item: FeedbackItem): string {
  const who = { name: item.fullName, number: item.memberNumber };
  if (item.score === null || item.visitClosedAt === null) {
    return t('console.feedback.noteLine', { ...who, date: formatDayMonth(new Date(item.createdAt)) });
  }
  return t('console.feedback.ratingLine', { ...who, score: item.score, date: formatDayMonth(new Date(item.visitClosedAt)) });
}

function Item({ venueId, item }: { venueId: string; item: FeedbackItem }) {
  return (
    <Stack gap={1}>
      <Text variant="small" tone="muted">{feedbackLine(item)}</Text>
      {item.note === null ? null : <Text>{item.note}</Text>}
      {item.resolvedAt === null || item.resolvedBy === null || item.resolution === null ? null : (
        <Text variant="small">
          {t('console.feedback.resolvedLine', { name: item.resolvedBy, date: formatDayMonth(new Date(item.resolvedAt)), resolution: item.resolution })}
        </Text>
      )}
      {item.isTicket && item.resolvedAt === null ? <ResolveForm venueId={venueId} item={item} /> : null}
    </Stack>
  );
}

function Section({ venueId, title, items, emptyText }: { venueId: string; title: string; items: readonly FeedbackItem[]; emptyText: string }) {
  return (
    <Stack gap={4}>
      <Heading level={2}>{title}</Heading>
      {items.length === 0 ? <Text tone="muted">{emptyText}</Text> : (
        <Stack gap={4} divided>{items.map((item) => <Item key={item.id} venueId={venueId} item={item} />)}</Stack>
      )}
    </Stack>
  );
}

function FeedbackList({ venueId }: { venueId: string }) {
  const list = useVenueFeedback(venueId);
  const title = t('console.feedback.title');
  if (list.isPending) return <Screen title={title} status="loading" />;
  if (list.data === undefined) return <Screen title={title} status="error" onRetry={() => void list.refetch()} />;
  const isOpen = (item: FeedbackItem) => item.isTicket && item.resolvedAt === null;
  return (
    <Screen title={title}>
      <Stack gap={8}>
        <Section venueId={venueId} title={t('console.feedback.open')} items={list.data.filter(isOpen)} emptyText={t('console.feedback.noneOpen')} />
        <Section venueId={venueId} title={t('console.feedback.recent')} items={list.data.filter((item) => !isOpen(item))}
          emptyText={t('console.feedback.noneRecent')} />
      </Stack>
    </Screen>
  );
}
