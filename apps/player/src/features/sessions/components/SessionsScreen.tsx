import { useFeatureStatus } from '@rivr/db';
import { useMySessions, type MySession } from '@rivr/db/sessions';
import { formatDuration, formatMonth, formatNumber, t } from '@rivr/i18n';
import { Button, FeatureGate, Heading, HistoryRow, Inline, Screen, Stack, Text } from '@rivr/ui';
import { useNavigate } from '@tanstack/react-router';
import { sessionDay, sessionLine, sessionTitle } from './naming.ts';
import { useState } from 'react';

/** The sessions of each club month in turn, as the list comes: newest first. */
function byMonth(sessions: readonly MySession[]): MySession[][] {
  const months: MySession[][] = [];
  for (const session of sessions) {
    const month = months.at(-1);
    if (month?.[0]?.month === session.month) month.push(session);
    else months.push([session]);
  }
  return months;
}

/**
 * One club month: its name, how many sessions and hours in the list, then each session, which opens to its detail. The
 * oldest month on a page may go on past it (`isPartial`): it shows no count until Show earlier sessions loads the rest.
 */
function Month({ sessions, isPartial, onOpen }: { sessions: readonly MySession[]; isPartial: boolean; onOpen: (visitId: string) => void }) {
  const [first] = sessions;
  if (first === undefined) return null;
  // Counted from the list, not the month's totals, so a session the member hid is not counted either.
  const hours = formatDuration(sessions.reduce((seconds, session) => seconds + session.playedSeconds, 0));
  return (
    <Stack gap={2}>
      <Heading level={2}>{formatMonth(first.month)}</Heading>
      {isPartial ? null : (
        <Text variant="small" tone="muted">
          {sessions.length === 1
            ? t('player.sessions.monthSummaryOne', { hours })
            : t('player.sessions.monthSummary', { count: formatNumber(sessions.length), hours })}
        </Text>
      )}
      <Stack divided>
        {sessions.map((session) => (
          <HistoryRow key={session.visitId} when={sessionDay(session)} title={sessionTitle(session)} value={null}
            detail={sessionLine(session)} onOpen={() => onOpen(session.visitId)} />
        ))}
      </Stack>
    </Stack>
  );
}

/** How many sessions the list reads at a time (F3-28). */
const PAGE = 30;

/**
 * Sessions: the member's history by club month (#127), gated by tier (feature sessions.history). Each session shows when,
 * where and how long, and no money (#627). It reads a page at a time (F3-28) and waits until access is known.
 */

export function SessionsScreen() {
  const [count, setCount] = useState(PAGE);
  const sessions = useMySessions(count);
  const access = useFeatureStatus('sessions.history');
  const navigate = useNavigate();
  const title = t('player.sessions.title');
  if (access.status === 'error') return <Screen title={title} status="error" onRetry={access.retry} />;
  if (sessions.isError) return <Screen title={title} status="error" onRetry={() => void sessions.refetch()} />;
  if (sessions.data === undefined || access.status === 'loading') return <Screen title={title} status="loading" />;
  const open = (visitId: string) => void navigate({ to: '/sessions/$visitId', params: { visitId } });
  // A tier without session history sees the screen's heading over the locked notice, not a bare notice (F3-21).
  if (access.access.state !== 'enabled') return <Screen title={title}><FeatureGate access={access.access}>{null}</FeatureGate></Screen>;
  return (
    <FeatureGate access={access.access}>
      {sessions.data.sessions.length === 0
        ? <Screen title={title} status="empty" emptyText={t('player.sessions.empty')} />
        : (
          <Screen title={title}>
            <Stack gap={8}>
              {byMonth(sessions.data.sessions).map((month, index, months) => (
                <Month key={month[0]?.month} sessions={month} isPartial={sessions.data.hasEarlier && index === months.length - 1} onOpen={open} />
              ))}
              {sessions.data.hasEarlier ? (
                <Inline>
                  <Button variant="text" isLoading={sessions.isPlaceholderData} onClick={() => setCount((shown) => shown + PAGE)}>
                    {t('player.sessions.showEarlier')}
                  </Button>
                </Inline>
              ) : null}
            </Stack>
          </Screen>
        )}
    </FeatureGate>
  );
}
