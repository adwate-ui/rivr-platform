import type { FeedbackItem } from '@rivr/db';
import { formatDayMonth, t } from '@rivr/i18n';
import { Box, Inline, Stack, Text } from '@rivr/ui';
import { kindLine, ratingsLine, whoLine } from './feedbackLines.ts';
import { ResolveForm } from './ResolveForm.tsx';

/** What was done, by whom and when, once a ticket is resolved; null before. */
function resolvedLine(item: FeedbackItem): string | null {
  if (item.resolvedAt === null || item.resolvedBy === null || item.resolution === null) return null;
  return t('console.feedback.resolvedLine', { name: item.resolvedBy, date: formatDayMonth(new Date(item.resolvedAt)), resolution: item.resolution });
}

/**
 * One piece of feedback (console v3): who sent it, what it is and when, the detailed form's ratings, the note; then, while
 * it is an open ticket, what was done to resolve it, or once resolved, that with the staff member's name.
 */
export function FeedbackCard({ venueId, item }: { venueId: string; item: FeedbackItem }) {
  const resolved = resolvedLine(item);
  return (
    <Box as="article" surface="raised" radius="md" padding={4}>
      <Stack gap={2}>
        <Inline gap={3} justify="between" align="center" wrap>
          <Text variant="secondary" weight="medium">{whoLine(item)}</Text>
          <Text variant="caption" tone="muted">{kindLine(item)}</Text>
        </Inline>
        {item.ratings === null ? null : <Text variant="caption" tone="muted">{ratingsLine(item.ratings)}</Text>}
        {item.note === null ? null : <Text variant="row">{item.note}</Text>}
        {resolved === null ? null : <Text variant="secondary" tone="muted">{resolved}</Text>}
        {item.isTicket && item.resolvedAt === null ? <ResolveForm venueId={venueId} item={item} /> : null}
      </Stack>
    </Box>
  );
}
