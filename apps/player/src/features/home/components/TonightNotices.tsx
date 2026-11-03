import type { Notice } from '@rivr/db/notices';
import { t } from '@rivr/i18n';
import { Box, NoticeCard, Stack } from '@rivr/ui';

// Two at most: a third waits until one ends, so the offers and the tables stay in reach (decision 0424).
const SHOWN = 2;

/**
 * The club's notices on Tonight while the member browses (decision 0424): under the urgent banners and above Rate visit,
 * the offers and the tables, each a card with its words in full. They stay while they run: nothing dismisses them.
 */
export function TonightNotices({ notices }: { notices: readonly Notice[] }) {
  if (notices.length === 0) return null;
  return (
    <Box paddingX={5}>
      <Stack gap={2}>
        {notices.slice(0, SHOWN).map((notice) => <NoticeCard key={notice.noticeId} label={t('player.live.notice')} text={notice.body} />)}
      </Stack>
    </Box>
  );
}
