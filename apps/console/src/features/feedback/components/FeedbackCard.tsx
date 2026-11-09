import type { FeedbackItem } from '@rivr/db';
import { formatDayMonth, t } from '@rivr/i18n';
import { Box, Inline, Stack, Text } from '@rivr/ui';
import { kindLine, ratingsLine, whoLine } from './feedbackLines.ts';

/** What was done, by whom and when, once a ticket is resolved; null before. */
function resolvedLine(item: FeedbackItem): string | null {
  if (item.resolvedAt === null || item.resolvedBy === null || item.resolution === null) return null;
  return t('console.feedback.resolvedLine', { name: item.resolvedBy, date: formatDayMonth(new Date(item.resolvedAt)), resolution: item.resolution });
}

/**
 * One piece of feedback (console v3): who sent it, what it is and when, the detailed form's ratings, the note; once
 * resolved, what was done, with the staff member's name.
 */
export function FeedbackCard({ item }: { item: FeedbackItem }) {
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
      </Stack>
    </Box>
  );
}
