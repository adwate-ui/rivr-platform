import { useMarkTournamentRegistered, useStaffVenue, useTournamentInterest, type TournamentInterest, type TournamentInterestFailure } from '@rivr/db';
import { formatDayTime, formatNumber, t } from '@rivr/i18n';
import { Button, ErrorMessage, Heading, Inline, Screen, Stack, Text } from '@rivr/ui';
import { useState } from 'react';

/** Each tournament's interest, in the list's order: soonest tournament first, then in the order members asked. */
function byTournament(interests: readonly TournamentInterest[]): TournamentInterest[][] {
  const groups: TournamentInterest[][] = [];
  for (const interest of interests) {
    const group = groups.at(-1);
    if (group?.[0]?.tournamentId === interest.tournamentId) group.push(interest);
    else groups.push([interest]);
  }
  return groups;
}

/** One member who asked: who, and Mark registered once they paid, or that they are. */
function InterestLine({ venueId, interest }: { venueId: string; interest: TournamentInterest }) {
  const mark = useMarkTournamentRegistered(venueId);
  const [failure, setFailure] = useState<TournamentInterestFailure | null>(null);
  const who = t('console.tournamentInterest.member', { name: interest.fullName, number: formatNumber(interest.memberNumber) });
  return (
    <Stack gap={1}>
      <Inline gap={4} justify="between" align="center">
        <Text>{who}</Text>
        {interest.registeredAt === null ? (
          <Button variant="secondary" isLoading={mark.isPending} aria-label={t('console.tournamentInterest.markName', { name: interest.fullName })}
            onClick={() => void mark.mutateAsync(interest.interestId).then((done) => setFailure(done.ok ? null : done.error))}>
            {t('console.tournamentInterest.mark')}
          </Button>
        ) : <Text variant="small" weight="medium">{t('console.tournamentInterest.registered')}</Text>}
      </Inline>
      {failure === null ? null : <ErrorMessage>{t(`console.tournamentInterest.failures.${failure}`)}</ErrorMessage>}
    </Stack>
  );
}

function InterestList({ venueId }: { venueId: string }) {
  const list = useTournamentInterest(venueId);
  const title = t('console.tournamentInterest.title');
  if (list.isPending) return <Screen title={title} status="loading" />;
  if (list.data === undefined) return <Screen title={title} status="error" onRetry={() => void list.refetch()} />;
  if (list.data.length === 0) return <Screen title={title} status="empty" emptyText={t('console.tournamentInterest.empty')} />;
  return (
    <Screen title={title}>
      <Stack gap={8}>
        {byTournament(list.data).map((group) => {
          const [first] = group;
          if (first === undefined) return null;
          return (
            <Stack key={first.tournamentId} gap={3}>
              <Heading level={2}>{t('console.tournamentInterest.tournament', { name: first.tournamentName, when: formatDayTime(new Date(first.startsAt)) })}</Heading>
              <Stack gap={3} divided>{group.map((interest) => <InterestLine key={interest.interestId} venueId={venueId} interest={interest} />)}</Stack>
            </Stack>
          );
        })}
      </Stack>
    </Screen>
  );
}

/**
 * Tournament interest (#636), for the floor (waitlist.manage): the members who registered interest in each upcoming
 * tournament from the app, each marked registered once they paid at the venue. The tournament module stays hidden.
 */
export function TournamentInterestScreen() {
  const staff = useStaffVenue();
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  return <InterestList venueId={staff.venue.venueId} />;
}
