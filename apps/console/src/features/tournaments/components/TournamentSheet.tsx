import { useTournamentActions, useTournamentInterested, type InterestedMember, type TournamentFailure, type VenueTournament } from '@rivr/db';
import { formatDayMonth, formatDayTime, formatNumber, t } from '@rivr/i18n';
import { Box, Button, ConfirmButton, DetailRow, ErrorMessage, Heading, Inline, LoadState, Sheet, Stack, Text, UnitInput, useToast } from '@rivr/ui';
import { useState, type ReactNode } from 'react';

/** What a refused step says: one that has started, was cancelled or was notified already says the list shows why. */
const failureText = (failure: TournamentFailure) => (failure === 'invalid' ? t('console.tournaments.stale') : t(`console.tournaments.failures.${failure}`));

/** A member who asked, with the day they did. */
function AskedLine({ member }: { member: InterestedMember }) {
  return (
    <Box paddingY={2} hairline="top">
      <Inline gap={4} justify="between" align="center">
        <Text variant="small">{t('console.tournaments.record.member', { name: member.fullName, number: formatNumber(member.memberNumber) })}</Text>
        <Text variant="small" tone="muted">{formatDayMonth(new Date(member.askedAt))}</Text>
      </Inline>
    </Box>
  );
}

/** The members who asked to be notified, the latest first; or that nobody has. */
function Asked({ tournamentId }: { tournamentId: string }) {
  const asked = useTournamentInterested(tournamentId);
  const list = (members: readonly InterestedMember[]) => (members.length === 0
    ? <Text tone="muted">{t('console.tournaments.record.nobody')}</Text>
    : <Stack gap={0}>{members.map((member) => <AskedLine key={member.memberId} member={member} />)}</Stack>);
  return (
    <Stack gap={2}>
      <Heading level={3} variant="section">{t('console.tournaments.record.asked')}</Heading>
      {asked.data === undefined ? <LoadState isError={asked.isError} onRetry={() => void asked.refetch()} /> : list(asked.data)}
    </Stack>
  );
}

interface TournamentSheetProps {
  venueId: string;
  tournament: VenueTournament;
  onClose: () => void;
}

type OnFailure = (failure: TournamentFailure | null) => void;

/** One to come: Cancel tournament, asked once more, and Notify with how many asked, the panel's one gold button, until it is sent. */
function UpcomingFooter({ venueId, tournament, onClose, onFailure }: TournamentSheetProps & { onFailure: OnFailure }) {
  const { notify, cancel } = useTournamentActions(venueId);
  const toast = useToast();
  const { name, tournamentId } = tournament;
  const send = async () => {
    const done = await notify.mutateAsync(tournamentId);
    onFailure(done.ok ? null : done.error);
    if (done.ok) toast(t('console.tournaments.record.notified', { count: formatNumber(done.value), name }));
  };
  const stop = async () => {
    const done = await cancel.mutateAsync(tournamentId);
    onFailure(done.ok ? null : done.error);
    if (!done.ok) return;
    toast(t('console.tournaments.record.cancelled', { name }));
    onClose();
  };
  return (
    <Inline gap={2} justify="end">
      <ConfirmButton variant="text" size="compact" label={t('console.tournaments.record.cancel')} confirm={t('console.tournaments.record.cancelConfirm')}
        isBusy={cancel.isPending} onConfirm={() => void stop()} />
      {tournament.notified === null ? (
        <Button variant="primary" size="compact" isLoading={notify.isPending} isDisabled={tournament.interested === 0} onClick={() => void send()}>
          {t('console.tournaments.record.notify', { count: formatNumber(tournament.interested) })}
        </Button>
      ) : null}
    </Inline>
  );
}

/** A past one's entries, typed, with Cancel and Save for the panel's foot. Blank, Save says to type them. */
function usePastEntries({ venueId, tournament, onClose, onFailure }: TournamentSheetProps & { onFailure: OnFailure }): { footer: ReactNode; field: ReactNode } {
  const { setEntries } = useTournamentActions(venueId);
  const toast = useToast();
  const [entries, setTyped] = useState<number | null>(tournament.entries);
  const [isMissing, setMissing] = useState(false);
  const save = async () => {
    setMissing(entries === null);
    if (entries === null) return;
    const done = await setEntries.mutateAsync({ tournamentId: tournament.tournamentId, entries });
    onFailure(done.ok ? null : done.error);
    if (!done.ok) return;
    toast(t('console.tournaments.record.entriesSaved'));
    onClose();
  };
  const footer = (
    <Inline gap={2} justify="end">
      <Button variant="text" size="compact" onClick={onClose}>{t('common.cancel')}</Button>
      <Button variant="primary" size="compact" isLoading={setEntries.isPending} onClick={() => void save()}>{t('console.tournaments.record.save')}</Button>
    </Inline>
  );
  const field = (
    <Stack gap={2}>
      <UnitInput label={t('console.tournaments.columns.entries')} unit="players" min={0} max={100_000} initialValue={tournament.entries}
        onChange={(typed) => { setMissing(false); setTyped(typed); }} />
      {isMissing ? <ErrorMessage>{t('console.tournaments.record.entriesMissing')}</ErrorMessage> : null}
    </Stack>
  );
  return { footer, field };
}

/** How many were notified, in words while none were: Not yet for one to come, nothing for a past one. */
function notifiedWords(tournament: VenueTournament): string {
  if (tournament.notified !== null) return formatNumber(tournament.notified);
  return t(tournament.isPast ? 'console.tournaments.none' : 'console.tournaments.notYet');
}

/**
 * A tournament's record in the panel at the side (redesign RD-26): its game, how many asked and were notified, and who
 * asked. One to come has Cancel tournament, which tells those who asked, and Notify, sent once. A past one takes its
 * entries. The caller keys it by the tournament, so it opens on that tournament's own values.
 */
export function TournamentSheet(props: TournamentSheetProps) {
  const { tournament, onClose } = props;
  const [failure, setFailure] = useState<TournamentFailure | null>(null);
  const past = usePastEntries({ ...props, onFailure: setFailure });
  const footer = tournament.isPast ? past.footer : <UpcomingFooter {...props} onFailure={setFailure} />;
  return (
    <Sheet place="console" isOpen onClose={onClose} title={tournament.name} subtitle={formatDayTime(new Date(tournament.startsAt))} footer={footer}>
      <Stack gap={6}>
        <Box>
          <DetailRow label={t('console.tournaments.columns.game')} labelTone="muted" value={tournament.game === '' ? t('console.tournaments.none') : tournament.game} />
          <DetailRow label={t('console.tournaments.columns.interested')} labelTone="muted" value={formatNumber(tournament.interested)} />
          <DetailRow label={t('console.tournaments.columns.notified')} labelTone="muted" value={notifiedWords(tournament)} />
          <DetailRow label={t('console.tournaments.record.status')} labelTone="muted" isLast
            value={t(tournament.isPast ? 'console.tournaments.record.past' : 'console.tournaments.record.upcoming')} />
        </Box>
        {tournament.isPast ? past.field : null}
        {failure === null ? null : <ErrorMessage>{failureText(failure)}</ErrorMessage>}
        <Asked tournamentId={tournament.tournamentId} />
      </Stack>
    </Sheet>
  );
}
