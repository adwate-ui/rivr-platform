import { useEnterWithTicket, useFeature, useMyTournamentTickets, type MyTournamentTicket } from '@rivr/db';
import { formatDayTime, formatMoney, t } from '@rivr/i18n';
import { Button, ErrorMessage, FeatureGate, Inline, Stack, StatusMessage, Text } from '@rivr/ui';
import { useState } from 'react';

const SHOWN_FAILURES = ['registration_closed', 'identity', 'on_break', 'switched_off', 'room_full', 'no_ticket'] as const;
type ShownFailure = (typeof SHOWN_FAILURES)[number];
const shownFailure = (failure: string): ShownFailure | 'other' => SHOWN_FAILURES.find((each) => each === failure) ?? 'other';

/** One ticket: the tournament it enters and when, its value, and entering with it once per request id until the server answers. */
function TicketCard({ ticket, onEntered }: { ticket: MyTournamentTicket; onEntered: (name: string) => void }) {
  const enter = useEnterWithTicket();
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [failure, setFailure] = useState<ShownFailure | 'other' | null>(null);
  const use = () => void enter.mutateAsync({ ticket, requestId }).then((done) => {
    setFailure(done.ok ? null : shownFailure(done.error));
    if (done.ok) onEntered(ticket.tournamentName);
    if (done.ok || done.error !== 'unavailable') setRequestId(crypto.randomUUID());
  });
  return (
    <Stack gap={2}>
      <Text weight="medium">{t('player.tonight.ticketLine', { name: ticket.tournamentName, when: formatDayTime(new Date(ticket.startsAt)) })}</Text>
      <Text variant="small" tone="muted">{t('player.tonight.ticketValue', { amount: formatMoney(ticket.value) })}</Text>
      <Inline><Button variant="secondary" isLoading={enter.isPending} onClick={use}>{t('player.tonight.enterWithTicket')}</Button></Inline>
      {failure === null ? null : <ErrorMessage>{t(`player.tonight.buyFailures.${failure}`)}</ErrorMessage>}
    </Stack>
  );
}

/**
 * The satellite tickets the member holds (#519, decision 0250), each entering its tournament with no money taken;
 * feature tournaments.register. Quiet while loading and with none, as Home's other sections.
 */
export function TournamentTickets() {
  const register = useFeature('tournaments.register');
  const tickets = useMyTournamentTickets();
  const [enteredName, setEnteredName] = useState<string | null>(null);
  if (tickets.isError) {
    return (
      <Inline gap={3} align="center">
        <ErrorMessage>{t('player.tonight.ticketsFailed')}</ErrorMessage>
        <Button variant="text" onClick={() => void tickets.refetch()}>{t('common.retry')}</Button>
      </Inline>
    );
  }
  const held = tickets.data ?? [];
  // A member without tournament registration holds no tickets here, and Home's tournament says the feature is locked.
  return (
    <FeatureGate access={register}>
      <Stack gap={3}>
        {held.length === 0 ? null : <Text weight="medium">{t('player.tonight.tickets')}</Text>}
        {held.map((ticket) => <TicketCard key={ticket.ticketId} ticket={ticket} onEntered={setEnteredName} />)}
        <StatusMessage>{enteredName === null ? null : t('player.tonight.enteredWithTicket', { name: enteredName })}</StatusMessage>
      </Stack>
    </FeatureGate>
  );
}
