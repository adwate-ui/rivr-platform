import {
  useMarkTournamentRegistered, useStaffVenue, useTournamentInterest, useUnmarkTournamentRegistered, type TournamentInterest, type TournamentInterestFailure,
} from '@rivr/db';
import { formatDayTime, formatNumber, t } from '@rivr/i18n';
import { Box, Button, ErrorMessage, Heading, Inline, LoadState, Skeleton, Stack, Text, useToast } from '@rivr/ui';
import { useState } from 'react';
import { PublishTournament } from './PublishTournament.tsx';

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

/**
 * One member who asked: who, and Mark registered once they paid, or that they are. Marking says so in a toast with Undo,
 * which takes the registration back through its own function (console v3).
 */
function InterestLine({ venueId, interest }: { venueId: string; interest: TournamentInterest }) {
  const mark = useMarkTournamentRegistered(venueId);
  const unmark = useUnmarkTournamentRegistered(venueId);
  const toast = useToast();
  const [failure, setFailure] = useState<TournamentInterestFailure | 'undo' | null>(null);
  const name = interest.fullName;
  const undo = () => void unmark.mutateAsync(interest.interestId).then((done) => setFailure(done.ok ? null : 'undo'));
  const markNow = async () => {
    const done = await mark.mutateAsync(interest.interestId);
    setFailure(done.ok ? null : done.error);
    if (done.ok) toast(t('console.tournamentInterest.marked', { name }), { onUndo: undo });
  };
  return (
    <Box paddingX={4} paddingY={2} hairline="top">
      <Stack gap={1}>
        <Inline gap={4} justify="between" align="center">
          <Text variant="small">{t('console.tournamentInterest.member', { name, number: formatNumber(interest.memberNumber) })}</Text>
          {interest.registeredAt === null ? (
            <Button variant="subtle" size="small" isLoading={mark.isPending} aria-label={t('console.tournamentInterest.markName', { name })}
              onClick={() => void markNow()}>
              {t('console.tournamentInterest.mark')}
            </Button>
          ) : <Text variant="secondary" tone="muted">{t('console.tournamentInterest.registered')}</Text>}
        </Inline>
        {failure === null ? null : (
          <ErrorMessage>{t(failure === 'undo' ? 'console.tournamentInterest.undoFailed' : `console.tournamentInterest.failures.${failure}`)}</ErrorMessage>
        )}
      </Stack>
    </Box>
  );
}

/** One tournament's card: its name and start, how many asked and how many are registered, then each member who asked. */
function TournamentCard({ venueId, group }: { venueId: string; group: readonly TournamentInterest[] }) {
  const [first] = group;
  if (first === undefined) return null;
  const registered = group.filter((interest) => interest.registeredAt !== null).length;
  return (
    <Box as="section" surface="raised" radius="lg">
      <Box paddingX={4} paddingY={3}>
        <Inline gap={3} justify="between" align="baseline" wrap>
          <Inline gap={3} align="baseline" wrap>
            <Heading level={2} variant="card">{first.tournamentName}</Heading>
            <Text as="span" variant="secondary" tone="muted">{formatDayTime(new Date(first.startsAt))}</Text>
          </Inline>
          <Text as="span" variant="secondary" tone="muted">{t('console.tournamentInterest.counts', { interested: group.length, registered })}</Text>
        </Inline>
      </Box>
      {group.map((interest) => <InterestLine key={interest.interestId} venueId={venueId} interest={interest} />)}
    </Box>
  );
}

/** The tab once the staff member's venue is known: the cards, or that nobody asked, then the form to publish one. */
function InterestTab({ venueId }: { venueId: string }) {
  const list = useTournamentInterest(venueId);
  if (list.isPending) return <Skeleton look="rows" />;
  if (list.data === undefined) return <LoadState isError onRetry={() => void list.refetch()} />;
  return (
    <Stack gap={8}>
      {list.data.length === 0 ? <Text tone="muted">{t('console.tournamentInterest.empty')}</Text> : (
        <Stack gap={4}>{byTournament(list.data).map((group) => <TournamentCard key={group[0]?.tournamentId} venueId={venueId} group={group} />)}</Stack>
      )}
      <PublishTournament venueId={venueId} />
    </Stack>
  );
}

/**
 * Tournament interest, the Waitlist screen's second tab (#636; console v3), for staff who manage tournaments: a card for
 * each upcoming tournament with the members who registered interest from the app, each marked registered once they paid
 * at the venue; then a new tournament to publish without money (#800). The tournament module stays hidden.
 */
export function TournamentInterestList() {
  const staff = useStaffVenue();
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  return <InterestTab venueId={staff.venue.venueId} />;
}
