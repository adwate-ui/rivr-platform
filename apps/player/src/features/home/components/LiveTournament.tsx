import { useElapsedNow, type MyTournament } from '@rivr/db';
import { clockAt, levelAtOrAfter, nextLevelAfter, type ClockPosition, type Stage } from '@rivr/domain/tournament';
import { formatBlinds, formatCountdown, t } from '@rivr/i18n';
import { Inline, Stack, Text } from '@rivr/ui';

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
 * the level's time left counting down from what the server last said, the players left of the entries,
 * the blinds and the pool (#118).
 */
export function LiveTournament({ tournament }: { tournament: MyTournament }) {
  const elapsed = useElapsedNow(tournament.clock);
  if (tournament.stages.length === 0) return null;
  const position = clockAt(tournament.stages, elapsed);
  const field = tournament.field;
  return (
    <Stack gap={1}>
      <Inline justify="between" align="baseline" gap={4}>
        <Text variant="small" tone="muted">{t('player.tonight.liveTournament')}</Text>
        {field.entries === 0 ? null : <Text variant="small" tone="muted">{t('player.tonight.liveLeft', { left: field.playersLeft, entries: field.entries })}</Text>}
      </Inline>
      <Inline justify="between" align="baseline" gap={4}>
        <Text weight="medium">{t(position.isBreak ? 'player.tonight.liveBreak' : 'player.tonight.liveLevel', { name: tournament.name, level: position.level })}</Text>
        <Text variant="lead" weight="medium" isTabular>{formatCountdown(position.secondsLeft)}</Text>
      </Inline>
      <Inline justify="between" align="baseline" gap={4}>
        <Text variant="small" tone="muted">{tournament.clock.isRunning ? blindsLine(tournament.stages, position) : t('player.tonight.livePaused')}</Text>
      </Inline>
    </Stack>
  );
}
