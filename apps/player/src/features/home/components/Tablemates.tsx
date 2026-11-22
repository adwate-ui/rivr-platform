import { useFeature, useMyTablemates, type MySeat, type Tablemate } from '@rivr/db';
import { formatTime, t } from '@rivr/i18n';
import { Box, DetailRow, LoadState, Stack, Text } from '@rivr/ui';

/** A tablemate's call time in words: `Until 23:40`, `Not set`, `Away` or `Done`. */
function callTimeWords(mate: Tablemate): string {
  if (mate.callTime.kind === 'until') return t('player.live.tablemates.until', { time: formatTime(new Date(mate.callTime.endsAt)) });
  if (mate.callTime.kind === 'away') return t('player.live.tablemates.away');
  return t(mate.callTime.kind === 'done' ? 'player.live.tablemates.done' : 'player.live.tablemates.notSet');
}

/** `Seat 3 · Ritika`, or `Seat 3` for one who keeps their name off the TVs. */
const whoWords = (mate: Tablemate) => (mate.firstName === null ? t('player.live.tablemates.seat', { seat: mate.seat })
  : t('player.live.tablemates.seatName', { seat: mate.seat, name: mate.firstName }));

/**
 * The others at the member's table and their call time (the owner, 22 Nov): `Seat 3 · Ritika`, `Until 23:40`. For a member
 * who sees call time, at a seat with call time; nothing while it loads or while no one else sits there.
 */
export function Tablemates({ seat }: { seat: MySeat }) {
  const callTime = useFeature('call_time.view');
  const isShown = callTime.state === 'enabled' && seat.hasCallTime;
  const mates = useMyTablemates(isShown);
  if (!isShown) return null;
  if (mates.isError && mates.data === undefined) return <Box paddingX={5}><LoadState isError onRetry={() => void mates.refetch()} /></Box>;
  const list = mates.data ?? [];
  if (list.length === 0) return null;
  return (
    <Box paddingX={5} paddingY={4}>
      <Stack gap={2}>
        <Text variant="caption" tone="muted">{t('player.live.tablemates.title')}</Text>
        <Stack gap={0}>
          {list.map((mate, index) => (
            <DetailRow key={mate.seat} size="small" label={whoWords(mate)} value={callTimeWords(mate)} valueTone="muted" isLast={index === list.length - 1} />
          ))}
        </Stack>
      </Stack>
    </Box>
  );
}
