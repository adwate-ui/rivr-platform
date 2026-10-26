import { useElapsedNow, useTvTournamentClock, type LiveTournament } from '@rivr/db';
import { clockAt, levelAtOrAfter, nextLevelAfter } from '@rivr/domain/tournament';
import { formatBlinds, formatCountdown, formatNumber, t } from '@rivr/i18n';
import { Heading, Stack, Text, TvTournamentClock, type TvTournamentClockProps } from '@rivr/ui';

/** What the TV shows for a running tournament `elapsedSeconds` in: the level or break, its time left, the blinds, ante and next level. */
export function toClockProps(tournament: LiveTournament, elapsedSeconds: number): TvTournamentClockProps {
  const position = clockAt(tournament.stages, elapsedSeconds);
  const level = levelAtOrAfter(tournament.stages, position.stage);
  const next = nextLevelAfter(tournament.stages, position.stage);
  const showsBlinds = !position.isBreak && level !== undefined;
  return {
    name: tournament.name,
    level: position.isBreak ? t('tv.tournamentClock.breakLevel', { level: position.level }) : t('tv.tournamentClock.level', { level: position.level }),
    remaining: formatCountdown(position.secondsLeft),
    status: tournament.clock.isRunning ? undefined : t('tv.tournamentClock.paused'),
    blinds: showsBlinds ? formatBlinds(level.smallBlind, level.bigBlind) : t('tv.tournamentClock.break'),
    ante: showsBlinds && level.ante > 0 ? t('tv.tournamentClock.ante', { ante: formatNumber(level.ante) }) : undefined,
    next: next === undefined ? undefined : t('tv.tournamentClock.next', { blinds: formatBlinds(next.smallBlind, next.bigBlind, next.ante) }),
    stats: [],
    payoutsLabel: t('tv.tournamentClock.payouts'),
    payouts: [],
    noPayoutsText: t('tv.tournamentClock.noPayouts'),
  };
}

/**
 * The tournament clock (#119, decision 0201): the venue's running tournament, its level and time left
 * counting down from what the server last said, so a TV that reloads is back on the right level and second.
 */
export function TournamentClockMode() {
  const clock = useTvTournamentClock();
  const elapsed = useElapsedNow(clock.data?.clock);
  if (clock.data === undefined) {
    return <Text variant="tvBody" tone="muted">{t(clock.isError ? 'display.screen.unavailable' : 'common.loading')}</Text>;
  }
  if (clock.data === null) {
    return (
      <Stack gap={4}>
        <Heading level={1} variant="display">{t('tv.modes.tournament_clock')}</Heading>
        <Text variant="tvBody" tone="muted">{t('tv.tournamentClock.none')}</Text>
      </Stack>
    );
  }
  return <TvTournamentClock {...toClockProps(clock.data, elapsed)} />;
}
