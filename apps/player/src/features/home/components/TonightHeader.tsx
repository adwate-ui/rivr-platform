import type { MySeat } from '@rivr/db';
import { formatDuration, t } from '@rivr/i18n';
import { Box, Heading, Inline, PlayerAvatar, Stack, Text, Wordmark } from '@rivr/ui';

/** The left of the header: the wordmark, or seated, where they sit and the game with how long they have played. */
function HeaderTitle({ seat, now }: { seat: MySeat | null; now: Date }) {
  if (seat === null) return <Wordmark />;
  const played = Math.max(0, (now.getTime() - new Date(seat.startedAt).getTime()) / 1000);
  return (
    <Stack gap={1}>
      <Heading level={2} variant="serif" serifSize={28}>{t('player.live.seated.title', { table: seat.tableName, seat: seat.seat })}</Heading>
      <Text variant="small" tone="muted">{t('player.live.seated.playing', { game: seat.tableTypeName, time: formatDuration(played) })}</Text>
    </Stack>
  );
}

/**
 * Tonight's header (decision 0320): the wordmark while the member browses or waits; seated, where ("Table 1, seat 4") and
 * the game with how long they have played. The member's initial sits at the right of the same row, centred on either, as
 * in the prototype (Tonight heads itself, so it places the initial; owner, 3 Nov).
 */
export function TonightHeader({ seat, now }: { seat: MySeat | null; now: Date }) {
  return (
    <Box paddingX={5}>
      <Inline gap={4} justify="between">
        <HeaderTitle seat={seat} now={now} />
        <PlayerAvatar />
      </Inline>
    </Box>
  );
}
