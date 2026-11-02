import type { Notice } from '@rivr/db/notices';
import { Box, Stack, Text } from '@rivr/ui';

/** The club's notices in force (decision 0298), such as when it opens, as BreakNotice shows a break. Nothing when none is up. */
export function ClubNotices({ notices }: { notices: readonly Notice[] }) {
  if (notices.length === 0) return null;
  return (
    <Stack gap={3}>
      {notices.map((notice) => (
        <Box key={notice.noticeId} surface="raised" padding={4} radius="md">
          <Text>{notice.body}</Text>
        </Box>
      ))}
    </Stack>
  );
}
