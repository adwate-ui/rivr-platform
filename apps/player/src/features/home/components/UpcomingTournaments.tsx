import { useFeature, useMyUpcomingTournaments, useRegisterTournamentInterest, type TournamentInterestFailure, type UpcomingTournament } from '@rivr/db';
import { formatDayTime, t } from '@rivr/i18n';
import { Button, ErrorMessage, FeatureGate, Heading, Inline, Stack, Text } from '@rivr/ui';
import { useState } from 'react';

/** One upcoming tournament: its name and start, and the way to register interest, or where the member stands. */
function TournamentLine({ tournament }: { tournament: UpcomingTournament }) {
  const register = useRegisterTournamentInterest();
  const [failure, setFailure] = useState<TournamentInterestFailure | null>(null);
  const ask = () => void register.mutateAsync(tournament.tournamentId).then((done) => setFailure(done.ok ? null : done.error));
  return (
    <Stack gap={2}>
      <Inline gap={4} justify="between" align="baseline">
        <Stack gap={1}>
          <Text weight="medium">{tournament.name}</Text>
          <Text variant="small" tone="muted">{formatDayTime(new Date(tournament.startsAt))}</Text>
        </Stack>
        {tournament.standing === 'none' ? (
          <Button variant="secondary" isLoading={register.isPending} onClick={ask}
            aria-label={t('player.tonight.registerInterestName', { name: tournament.name })}>
            {t('player.tonight.registerInterest')}
          </Button>
        ) : <Text variant="small" weight="medium">{t(`player.tonight.standing.${tournament.standing}`)}</Text>}
      </Inline>
      {tournament.standing === 'interested' ? <Text variant="small" tone="muted">{t('player.tonight.payAtTheClub')}</Text> : null}
      {failure === null ? null : <ErrorMessage>{t(`player.tonight.interestFailures.${failure}`)}</ErrorMessage>}
    </Stack>
  );
}

/**
 * The club's upcoming tournaments (#636; feature tournaments.register): a member registers interest, pays at the club,
 * and the floor marks them registered. Quiet while loading, as Home's other sections, and with none coming up.
 */
export function UpcomingTournaments() {
  const access = useFeature('tournaments.register');
  const upcoming = useMyUpcomingTournaments();
  const list = upcoming.data ?? [];
  return (
    <FeatureGate access={access}>
      {list.length === 0 ? null : (
        <Stack gap={3}>
          <Heading level={2}>{t('player.tonight.upcoming')}</Heading>
          <Stack gap={3} divided>{list.map((tournament) => <TournamentLine key={tournament.tournamentId} tournament={tournament} />)}</Stack>
        </Stack>
      )}
    </FeatureGate>
  );
}
