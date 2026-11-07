import { useFeatureStatus } from '@rivr/db';
import { useHideMySession, useMySession, type MySession } from '@rivr/db/sessions';
import { formatHoursMinutes, formatNumber, formatStakes, formatTime, t } from '@rivr/i18n';
import { BackButton, Box, Button, DetailRow, ErrorMessage, FeatureGate, Heading, Screen, Stack, Text, useToast } from '@rivr/ui';
import { useParams } from '@tanstack/react-router';
import { useState } from 'react';
import { sessionDay, sessionTitle } from './naming.ts';
import { useGoBack } from '../../frame/goBack.ts';

/** The game a session was: a cash table's stakes, or the tournament with the member's place in its field (#549). */
function gameOf(session: MySession): string {
  if (session.kind === 'cash') return formatStakes(session.smallBlind, session.bigBlind);
  return session.place === null || session.entrants === null
    ? t('player.sessions.tournament')
    : t('player.sessions.tournamentPlace', { place: formatNumber(session.place), entrants: formatNumber(session.entrants) });
}

/** The day, the table large, Game, Time and Played, then Hide from my list, which says so with a toast (brief 3.6). */
function Detail({ session, onHidden }: { session: MySession; onHidden: () => void }) {
  const hide = useHideMySession();
  const toast = useToast();
  const [failed, setFailed] = useState(false);
  const onHide = async () => {
    const result = await hide.mutateAsync(session.visitId);
    setFailed(!result.ok);
    if (!result.ok) return;
    toast(t('player.sessions.hiddenToast'));
    onHidden();
  };
  const time = t('player.sessions.timeRange', { from: formatTime(new Date(session.openedAt)), to: formatTime(new Date(session.closedAt)) });
  return (
    <Stack gap={6}>
      <Stack gap={1}>
        <Text variant="small" tone="muted">{sessionDay(session)}</Text>
        <Heading level={1} variant="serif">{sessionTitle(session)}</Heading>
      </Stack>
      <Box>
        <DetailRow label={t('player.sessions.game')} labelTone="muted" value={gameOf(session)} />
        <DetailRow label={t('player.sessions.time')} labelTone="muted" value={time} />
        <DetailRow label={t('player.sessions.played')} labelTone="muted" value={formatHoursMinutes(session.playedSeconds)} isLast />
      </Box>
      <Button variant="outline" size="large" fullWidth onClick={() => void onHide()} isLoading={hide.isPending}>{t('player.sessions.hide')}</Button>
      {failed ? <ErrorMessage look="dot">{t('player.sessions.hideFailed')}</ErrorMessage> : null}
    </Stack>
  );
}

/**
 * A session's detail (decision 0320; #127): back to Sessions, then the session. Back goes back, so the phone's own back
 * button does not return here (F3-22); opened by address, it goes to the list.
 */
export function SessionScreen() {
  const { visitId = '' } = useParams({ strict: false });
  const sessions = useMySession(visitId);
  const access = useFeatureStatus('sessions.history');
  const toList = useGoBack('/sessions');
  const session = sessions.data ?? undefined;
  const title = t('player.sessions.title');
  const back = <BackButton label={title} onBack={toList} />;
  if (access.status === 'error') return <Screen title={title} isTitleHidden status="error" onRetry={access.retry} />;
  if (sessions.isError) return <Screen title={title} isTitleHidden status="error" onRetry={() => void sessions.refetch()} />;
  if (sessions.data === undefined || access.status === 'loading') return <Screen title={title} isTitleHidden status="loading" loadingLook="skeleton" />;
  if (access.access.state !== 'enabled') {
    // A tier without session history sees the screen's heading over the locked notice (F3-21).
    return <Stack gap={2}>{back}<Heading level={1} variant="serif">{title}</Heading><FeatureGate access={access.access}>{null}</FeatureGate></Stack>;
  }
  return (
    <Stack gap={2}>
      {back}
      {session === undefined ? <Text tone="muted">{t('player.sessions.notFound')}</Text> : <Detail session={session} onHidden={toList} />}
    </Stack>
  );
}
