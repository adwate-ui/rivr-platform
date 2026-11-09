import {
  useMarkTournamentRegistered, usePublishedTournamentActions, usePublishedTournaments, useStaffVenue, useTournamentInterest, useUnmarkTournamentRegistered,
  type PublishedTournament, type TournamentInterest, type TournamentInterestFailure,
} from '@rivr/db';
import { formatDayTime, formatNumber, t } from '@rivr/i18n';
import { Box, Button, ConfirmButton, ErrorMessage, Heading, Inline, Screen, Stack, Text, useToast } from '@rivr/ui';
import { useState } from 'react';
import { EditTournament } from './EditTournament.tsx';
import { PublishTournament } from './PublishTournament.tsx';

/**
 * One member who asked: who, and Mark registered once they paid, or that they are; on a withdrawn tournament only who.
 * Marking says so in a toast with Undo, which takes the registration back through its own function (console v3).
 */
function InterestLine({ venueId, interest, canMark }: { venueId: string; interest: TournamentInterest; canMark: boolean }) {
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
          {interest.registeredAt === null && canMark ? (
            <Button variant="subtle" size="small" isLoading={mark.isPending} aria-label={t('console.tournamentInterest.markName', { name })}
              onClick={() => void markNow()}>
              {t('console.tournamentInterest.mark')}
            </Button>
          ) : null}
          {interest.registeredAt === null ? null : <Text variant="secondary" tone="muted">{t('console.tournamentInterest.registered')}</Text>}
        </Inline>
        {failure === null ? null : (
          <ErrorMessage>{t(failure === 'undo' ? 'console.tournamentInterest.undoFailed' : `console.tournamentInterest.failures.${failure}`)}</ErrorMessage>
        )}
      </Stack>
    </Box>
  );
}

/** A tournament still to come: correcting it or withdrawing it from the app, asked once more (F-027); once withdrawn, publishing it again. */
function CardActions({ venueId, tournament, onEdit }: { venueId: string; tournament: PublishedTournament; onEdit: () => void }) {
  const { withdraw, publishAgain } = usePublishedTournamentActions(venueId);
  const [failure, setFailure] = useState<TournamentInterestFailure | null>(null);
  const { name } = tournament;
  const press = async (action: typeof withdraw) => {
    const done = await action.mutateAsync(tournament.tournamentId);
    setFailure(done.ok ? null : done.error);
  };
  return (
    <Stack gap={1}>
      {tournament.isPublished ? (
        <Inline gap={2}>
          <Button variant="subtle" size="small" aria-label={t('console.tournamentInterest.editName', { name })} onClick={onEdit}>{t('console.tournamentInterest.edit')}</Button>
          <ConfirmButton variant="subtle" size="small" label={t('console.tournamentInterest.withdraw')} name={t('console.tournamentInterest.withdrawName', { name })} confirm={t('console.tournamentInterest.withdrawConfirm')}
            isBusy={withdraw.isPending} onConfirm={() => void press(withdraw)} />
        </Inline>
      ) : (
        <Inline gap={2}>
          <Button variant="subtle" size="small" isLoading={publishAgain.isPending} aria-label={t('console.tournamentInterest.publishAgainName', { name })}
            onClick={() => void press(publishAgain)}>{t('console.tournamentInterest.publishAgain')}</Button>
        </Inline>
      )}
      {failure === null ? null : <ErrorMessage>{t(`console.tournamentInterest.publish.failures.${failure}`)}</ErrorMessage>}
    </Stack>
  );
}

/** One tournament's card: its name and start, how many asked and are registered, each member who asked, and its actions; one that has started has none. */
function TournamentCard({ venueId, tournament, interests }: { venueId: string; tournament: PublishedTournament; interests: readonly TournamentInterest[] }) {
  const [isEditing, setEditing] = useState(false);
  const actions = isEditing ? <EditTournament venueId={venueId} tournament={tournament} onDone={() => setEditing(false)} />
    : <CardActions venueId={venueId} tournament={tournament} onEdit={() => setEditing(true)} />;
  return (
    <Box as="section" surface="raised" radius="lg">
      <Box paddingX={4} paddingY={3}>
        <Stack gap={3}>
          <Inline gap={3} justify="between" align="baseline" wrap>
            <Inline gap={3} align="baseline" wrap>
              <Heading level={2} variant="card">{tournament.name}</Heading>
              <Text as="span" variant="secondary" tone="muted">{formatDayTime(new Date(tournament.startsAt))}</Text>
              {tournament.isPublished ? null : <Text as="span" variant="secondary" weight="medium">{t('console.tournamentInterest.withdrawn')}</Text>}
            </Inline>
            <Text as="span" variant="secondary" tone="muted">{t('console.tournamentInterest.counts', { interested: tournament.interested, registered: tournament.registered })}</Text>
          </Inline>
          {tournament.hasStarted ? null : actions}
        </Stack>
      </Box>
      {interests.map((interest) => <InterestLine key={interest.interestId} venueId={venueId} interest={interest} canMark={tournament.isPublished} />)}
    </Box>
  );
}

/** The screen once the staff member's venue is known: a card for each published tournament, or that none is, then the form to publish one. */
function InterestTab({ venueId }: { venueId: string }) {
  const published = usePublishedTournaments(venueId);
  const list = useTournamentInterest(venueId);
  const title = t('console.tournamentInterest.title');
  if (published.isPending || list.isPending) return <Screen title={title} status="loading" loadingLook="rows" />;
  if (published.data === undefined || list.data === undefined) return <Screen title={title} status="error" onRetry={() => { void published.refetch(); void list.refetch(); }} />;
  const interests = list.data;
  return (
    <Screen title={title}>
      <Stack gap={8}>
        {published.data.length === 0 ? <Text tone="muted">{t('console.tournamentInterest.empty')}</Text> : (
          <Stack gap={4}>
            {published.data.map((tournament) => (
              <TournamentCard key={tournament.tournamentId} venueId={venueId} tournament={tournament}
                interests={interests.filter((interest) => interest.tournamentId === tournament.tournamentId)} />
            ))}
          </Stack>
        )}
        <PublishTournament venueId={venueId} />
      </Stack>
    </Screen>
  );
}

/**
 * Tournament interest, the Waitlist's second tab (#636; console v3), for staff who manage tournaments: a card for each
 * upcoming published tournament, whether or not anybody asked (F-027), to correct or withdraw, or publish again once withdrawn,
 * with the members who registered interest from the app, each marked registered once they paid at the venue, for a day
 * after its start; then a new tournament to publish without money (#800). The tournament module stays hidden.
 */
export function TournamentInterestScreen() {
  const staff = useStaffVenue();
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  return <InterestTab venueId={staff.venue.venueId} />;
}
