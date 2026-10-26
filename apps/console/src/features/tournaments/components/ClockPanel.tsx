import { useElapsedNow, useTournamentClock, type ClockChange, type VenueTournament } from '@rivr/db';
import { clockAt, levelAtOrAfter, nextLevelAfter, type ClockPosition, type Stage } from '@rivr/domain/tournament';
import { formatBlinds, formatCountdown, t } from '@rivr/i18n';
import { Button, ErrorMessage, Stack, Text, TournamentClock } from '@rivr/ui';
import { useState } from 'react';

/** What the clock shows for a position: the title with the level, the blinds or Break, and the next level. */
function clockLines(name: string, stages: readonly Stage[], position: ClockPosition) {
  const level = levelAtOrAfter(stages, position.stage);
  const next = nextLevelAfter(stages, position.stage);
  return {
    title: t(position.isBreak ? 'console.tournaments.breakTitle' : 'console.tournaments.clockTitle', { name, level: position.level }),
    blinds: position.isBreak || level === undefined ? t('console.tournaments.break') : formatBlinds(level.smallBlind, level.bigBlind, level.ante),
    next: next === undefined ? undefined : t('console.tournaments.next', { blinds: formatBlinds(next.smallBlind, next.bigBlind, next.ante) }),
  };
}

interface ControlsProps {
  tournament: VenueTournament;
  position: ClockPosition;
  isBusy: boolean;
  onChange: (change: ClockChange) => void;
}

/** Start before the clock runs; then Pause or Resume, and a level back or on (none after the last stage). */
function Controls({ tournament, position, isBusy, onChange }: ControlsProps) {
  if (tournament.clock === null) {
    return <Button variant="primary" isLoading={isBusy} onClick={() => onChange('start')}>{t('console.tournaments.start')}</Button>;
  }
  const isRunning = tournament.clock.isRunning;
  const isLast = position.stage >= tournament.stages.length - 1;
  return (
    <>
      <Button variant="primary" isLoading={isBusy} onClick={() => onChange(isRunning ? 'pause' : 'resume')}>
        {t(isRunning ? 'console.tournaments.pause' : 'console.tournaments.resume')}
      </Button>
      <Button variant="text" isDisabled={isBusy} onClick={() => onChange('previous')}>{t('console.tournaments.previousLevel')}</Button>
      <Button variant="text" isDisabled={isBusy || isLast} onClick={() => onChange('next')}>{t('console.tournaments.nextLevel')}</Button>
    </>
  );
}

/**
 * A tournament's clock and the floor's controls (#119, decision 0201): the server keeps the clock, and this
 * counts down from what it last said, a second at a time. A clock not started shows level 1 in full.
 */
export function ClockPanel({ venueId, tournament }: { venueId: string; tournament: VenueTournament }) {
  const change = useTournamentClock(venueId);
  const [failure, setFailure] = useState<string | null>(null);
  const elapsed = useElapsedNow(tournament.clock);
  if (tournament.stages.length === 0) return <Text tone="muted">{t('console.tournaments.noLevels')}</Text>;
  const position = clockAt(tournament.stages, elapsed);
  const lines = clockLines(tournament.name, tournament.stages, position);
  const status = tournament.clock === null ? t('console.tournaments.notStarted') : tournament.clock.isRunning ? undefined : t('console.tournaments.paused');
  const onChange = (asked: ClockChange) => {
    void change.mutateAsync({ tournamentId: tournament.id, change: asked }).then((done) => {
      setFailure(done.ok ? null : t(`console.tournaments.failures.${done.error}`));
    });
  };
  return (
    <Stack gap={4}>
      <TournamentClock title={lines.title} remaining={formatCountdown(position.secondsLeft)} blinds={lines.blinds} next={lines.next} status={status}
        actions={<Controls tournament={tournament} position={position} isBusy={change.isPending} onChange={onChange} />} />
      {failure === null ? null : <ErrorMessage>{failure}</ErrorMessage>}
    </Stack>
  );
}
