import { useFeatureStatus } from '@rivr/db';
import { useMySessions, type MySession } from '@rivr/db/sessions';
import { formatHoursMinutes, formatNumber, t } from '@rivr/i18n';
import { Button, FeatureGate, HistoryRow, Inline, Screen, Stack, StatRow, Text } from '@rivr/ui';
import { clubDay } from '@rivr/domain/clubDay';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { sessionDay, sessionLine, sessionTitle } from './naming.ts';

const PAGE = 30;

/**
 * "This month" and "Hours played": the current club month's totals as the server counts them on each of its sessions, so
 * a month longer than the page still counts whole (F3-28); none yet this month reads 0.
 */
function MonthStats({ latest }: { latest: MySession | undefined }) {
  const [thisMonth] = useState(() => `${clubDay(new Date()).slice(0, 7)}-01`);
  const month = latest?.month === thisMonth ? latest : undefined;
  return (
    <StatRow stats={[
      { label: t('player.sessions.thisMonth'), value: formatNumber(month?.monthSessions ?? 0) },
      { label: t('player.sessions.hoursPlayed'), value: formatHoursMinutes(month?.monthPlayedSeconds ?? 0) },
    ]} />
  );
}

/** The list: a row a session, newest first, each opening its detail; Show earlier while there are more. */
function SessionList({ sessions, hasEarlier, isLoadingMore, onMore, onOpen }: {
  sessions: readonly MySession[]; hasEarlier: boolean; isLoadingMore: boolean; onMore: () => void; onOpen: (sessionId: string) => void;
}) {
  return (
    <Stack gap={6}>
      <MonthStats latest={sessions[0]} />
      <Stack divided>
        {sessions.map((session) => (
          <HistoryRow key={session.sessionId} when={sessionDay(session)} title={sessionTitle(session)} value={<Text>{sessionLine(session)}</Text>}
            onOpen={() => onOpen(session.sessionId)} />
        ))}
      </Stack>
      {hasEarlier ? (
        <Inline><Button variant="text" isLoading={isLoadingMore} onClick={onMore}>{t('player.sessions.showEarlier')}</Button></Inline>
      ) : null}
    </Stack>
  );
}

/**
 * Sessions (decision 0320; #127, #549, #627): "This month" and "Hours played", then each session with its day, table and
 * time played, opening its detail. With feature sessions.history; a tier without it sees the title over the locked notice.
 */
export function SessionsScreen() {
  const [count, setCount] = useState(PAGE);
  const sessions = useMySessions(count);
  const access = useFeatureStatus('sessions.history');
  const navigate = useNavigate();
  const title = t('player.sessions.title');
  const look = { titleLook: 'serif' } as const;
  if (access.status === 'error') return <Screen {...look} title={title} status="error" onRetry={access.retry} />;
  if (sessions.isError) return <Screen {...look} title={title} status="error" onRetry={() => void sessions.refetch()} />;
  if (sessions.data === undefined || access.status === 'loading') return <Screen {...look} title={title} status="loading" loadingLook="skeleton" />;
  if (access.access.state !== 'enabled') return <Screen {...look} title={title}><FeatureGate access={access.access}>{null}</FeatureGate></Screen>;
  if (sessions.data.sessions.length === 0) return <Screen {...look} title={title} status="empty" emptyText={t('player.sessions.empty')} />;
  return (
    <Screen {...look} title={title}>
      <SessionList sessions={sessions.data.sessions} hasEarlier={sessions.data.hasEarlier} isLoadingMore={sessions.isPlaceholderData}
        onMore={() => setCount((shown) => shown + PAGE)} onOpen={(sessionId) => void navigate({ to: '/sessions/$sessionId', params: { sessionId } })} />
    </Screen>
  );
}
