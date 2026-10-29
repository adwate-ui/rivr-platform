import { useFeature } from '@rivr/db';
import { useHideMySession, useMySessions, type MySession } from '@rivr/db/sessions';
import { formatDuration, formatTime, t } from '@rivr/i18n';
import { Button, ErrorMessage, FeatureGate, Inline, Screen, Stack, Text } from '@rivr/ui';
import { useNavigate, useParams } from '@tanstack/react-router';
import { useState } from 'react';
import { sessionDay, sessionLine, sessionTitle } from './naming.ts';

/** One session (#627): when, its time and hours, and the way to hide it from the member's own list. No money. */
function Detail({ session, onHidden }: { session: MySession; onHidden: () => void }) {
  const hide = useHideMySession();
  const [failed, setFailed] = useState(false);
  const rows = [
    { label: t('player.sessions.time'), value: t('player.sessions.timeRange', { from: formatTime(new Date(session.openedAt)), to: formatTime(new Date(session.closedAt)) }) },
    { label: t('player.sessions.hours'), value: formatDuration(session.playedSeconds) },
  ];
  const onHide = async () => {
    setFailed(false);
    const result = await hide.mutateAsync(session.visitId);
    if (result.ok) onHidden();
    else setFailed(true);
  };
  return (
    <Stack gap={6}>
      <Stack gap={1}>
        <Text tone="muted">{sessionDay(session)}</Text>
        {session.kind === 'tournament' ? <Text tone="muted">{sessionLine(session)}</Text> : null}
      </Stack>
      <Stack gap={3} divided>
        {rows.map((row) => (
          <Inline key={row.label} gap={4} align="baseline" justify="between">
            <Text tone="muted">{row.label}</Text>
            <Text>{row.value}</Text>
          </Inline>
        ))}
      </Stack>
      <Stack gap={2}>
        <Button variant="secondary" onClick={() => void onHide()} isLoading={hide.isPending}>{t('player.sessions.hide')}</Button>
        <Text variant="small" tone="muted">{t('player.sessions.hideNote')}</Text>
        {failed ? <ErrorMessage>{t('player.sessions.hideFailed')}</ErrorMessage> : null}
      </Stack>
    </Stack>
  );
}

/** A session's detail (#127), from the history already loaded; gated as the history is. */
export function SessionScreen() {
  const { visitId = '' } = useParams({ strict: false });
  const sessions = useMySessions();
  const access = useFeature('sessions.history');
  const navigate = useNavigate();
  const toList = () => void navigate({ to: '/sessions' });
  const back = <Button variant="text" icon="chevronLeft" onClick={toList}>{t('common.back')}</Button>;
  const session = sessions.data?.find((one) => one.visitId === visitId);
  const title = session === undefined ? t('player.sessions.title') : sessionTitle(session);
  if (sessions.isError) return <Screen title={title} actions={back} status="error" onRetry={() => void sessions.refetch()} />;
  if (sessions.data === undefined) return <Screen title={title} actions={back} status="loading" />;
  return (
    <FeatureGate access={access}>
      {session === undefined
        ? <Screen title={title} actions={back} status="empty" emptyText={t('player.sessions.notFound')} />
        : <Screen title={title} actions={back}><Detail session={session} onHidden={toList} /></Screen>}
    </FeatureGate>
  );
}
