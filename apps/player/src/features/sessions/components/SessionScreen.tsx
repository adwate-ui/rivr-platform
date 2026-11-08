import { useFeatureStatus } from '@rivr/db';
import { useHideMySession, useMySession, type MySession } from '@rivr/db/sessions';
import { formatHoursMinutes, formatNumber, formatStakes, formatTime, t } from '@rivr/i18n';
import { BackButton, Box, Button, DetailRow, ErrorMessage, FeatureGate, Heading, Screen, Stack, Text, useHeadingFocus, usePageTitle, useToast } from '@rivr/ui';
import { useCanGoBack, useNavigate, useParams, useRouter } from '@tanstack/react-router';
import { useId, useState } from 'react';
import { sessionDay, sessionTitle } from './naming.ts';

/** The game a session was: a cash table's stakes, or the tournament with the member's place in its field (#549). */
function gameOf(session: MySession): string {
  if (session.kind === 'cash') return formatStakes(session.smallBlind, session.bigBlind);
  return session.place === null || session.entrants === null
    ? t('player.sessions.tournament')
    : t('player.sessions.tournamentPlace', { place: formatNumber(session.place), entrants: formatNumber(session.entrants) });
}

/** The day, the table large, Game, Time and Played, then Hide from my list, which says so with a toast (brief 3.6). */
function Detail({ session, onHidden, headingId }: { session: MySession; onHidden: () => void; headingId: string }) {
  const hide = useHideMySession();
  const toast = useToast();
  const [failed, setFailed] = useState(false);
  const onHide = async () => {
    const result = await hide.mutateAsync(session.sessionId);
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
        <Heading level={1} variant="serif" id={headingId} isFocusTarget>{sessionTitle(session)}</Heading>
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

/** Whether the detail shows: the session read, and the tier's access known. */
function isSessionShown(sessions: { data: unknown; isError: boolean }, accessStatus: string): boolean {
  return sessions.data !== undefined && !sessions.isError && accessStatus === 'ready';
}

/**
 * Drawn under its own Back button, the detail names the page after its session and takes the focus to its heading, as a
 * Screen would (WCAG 2.4.2), once it shows. Gives back the heading's id.
 */
function useSessionPage({ title, session, isShown }: { title: string; session: MySession | undefined; isShown: boolean }): string {
  const headingId = useId();
  usePageTitle(session === undefined ? title : sessionTitle(session), isShown);
  useHeadingFocus(headingId, isShown && session !== undefined);
  return headingId;
}

/**
 * A session's detail (decision 0320; #127): back to Sessions, then the session. Back goes back, so the phone's own back
 * button does not return here (F3-22); opened by address, it goes to the list.
 */
export function SessionScreen() {
  const { sessionId = '' } = useParams({ strict: false });
  const sessions = useMySession(sessionId);
  const access = useFeatureStatus('sessions.history');
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const navigate = useNavigate();
  // Back to where it was opened from, or to /sessions in its place: never a new entry on top (owner, 8 Nov).
  const toList = () => (canGoBack ? router.history.back() : void navigate({ to: '/sessions', replace: true }));
  const session = sessions.data ?? undefined;
  const title = t('player.sessions.title');
  const back = <BackButton label={title} onBack={toList} />;
  const headingId = useSessionPage({ title, session, isShown: isSessionShown(sessions, access.status) });
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
      {session === undefined ? <Text tone="muted">{t('player.sessions.notFound')}</Text> : <Detail session={session} onHidden={toList} headingId={headingId} />}
    </Stack>
  );
}
