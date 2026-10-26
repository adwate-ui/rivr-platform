import { useElapsedNow, useLiveTournament } from '@rivr/db';
import { clockAt, levelAtOrAfter, nextLevelAfter, type ClockPosition, type Stage } from '@rivr/domain/tournament';
import { formatBlinds, formatCountdown, t } from '@rivr/i18n';
import { Inline, Stack, Text } from '@rivr/ui';

/** Whether a tournament is running at the member's venue, so Home shows it in place of the next one. */
export function useIsTournamentLive(): boolean {
  return Boolean(useLiveTournament().data);
}

/** The blinds under the name: the level's, or on a break the next level's. */
function blindsLine(stages: readonly Stage[], position: ClockPosition): string {
  if (position.isBreak) {
    const next = nextLevelAfter(stages, position.stage);
    return next === undefined ? '' : t('player.tonight.liveNext', { blinds: formatBlinds(next.smallBlind, next.bigBlind, next.ante) });
  }
  const level = levelAtOrAfter(stages, position.stage);
  return level === undefined ? '' : formatBlinds(level.smallBlind, level.bigBlind, level.ante);
}

/**
 * The tournament running at the member's venue (#119, flow 10), as in the prototype: its name and level,
 * the level's time left counting down from what the server last said, and the blinds. Nothing while none runs.
 */
export function LiveTournament() {
  const live = useLiveTournament().data;
  const elapsed = useElapsedNow(live?.clock);
  if (!live) return null;
  const position = clockAt(live.stages, elapsed);
  return (
    <Stack gap={1}>
      <Text variant="small" tone="muted">{t('player.tonight.liveTournament')}</Text>
      <Inline justify="between" align="baseline" gap={4}>
        <Text weight="medium">{t(position.isBreak ? 'player.tonight.liveBreak' : 'player.tonight.liveLevel', { name: live.name, level: position.level })}</Text>
        <Text variant="lead" weight="medium" isTabular>{formatCountdown(position.secondsLeft)}</Text>
      </Inline>
      <Inline justify="between" align="baseline" gap={4}>
        <Text variant="small" tone="muted">{blindsLine(live.stages, position)}</Text>
        {live.clock.isRunning ? null : <Text variant="small" tone="muted">{t('player.tonight.livePaused')}</Text>}
      </Inline>
    </Stack>
  );
}
