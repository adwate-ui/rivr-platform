import { useFeature } from '@rivr/db';
import { useMySessions, type MySession } from '@rivr/db/sessions';
import { formatDuration, formatMonth, formatNumber, t } from '@rivr/i18n';
import { FeatureGate, Heading, HistoryRow, Screen, Stack, Text } from '@rivr/ui';
import { useNavigate } from '@tanstack/react-router';
import { sessionDay, sessionLine, sessionTitle } from './naming.ts';

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

/** One club month: its name, how many sessions and hours in the list, then each session, which opens to its detail. */
function Month({ sessions, onOpen }: { sessions: readonly MySession[]; onOpen: (visitId: string) => void }) {
  const [first] = sessions;
  if (first === undefined) return null;
  // Counted from the list, not the month's totals, so a session the member hid is not counted either.
  const hours = formatDuration(sessions.reduce((seconds, session) => seconds + session.playedSeconds, 0));
  return (
    <Stack gap={2}>
      <Heading level={2}>{formatMonth(first.month)}</Heading>
      <Text variant="small" tone="muted">
        {sessions.length === 1
          ? t('player.sessions.monthSummaryOne', { hours })
          : t('player.sessions.monthSummary', { count: formatNumber(sessions.length), hours })}
      </Text>
      <Stack divided>
        {sessions.map((session) => (
          <HistoryRow key={session.visitId} when={sessionDay(session)} title={sessionTitle(session)} value={null}
            detail={sessionLine(session)} onOpen={() => onOpen(session.visitId)} />
        ))}
      </Stack>
    </Stack>
  );
}

/**
 * Sessions: the member's history by club month (#127), gated by tier (feature sessions.history). Each session shows when,
 * where and how long, and no money (#627).
 */
export function SessionsScreen() {
  const sessions = useMySessions();
  const access = useFeature('sessions.history');
  const navigate = useNavigate();
  const title = t('player.sessions.title');
  if (sessions.isError) return <Screen title={title} status="error" onRetry={() => void sessions.refetch()} />;
  if (sessions.data === undefined) return <Screen title={title} status="loading" />;
  const open = (visitId: string) => void navigate({ to: '/sessions/$visitId', params: { visitId } });
  return (
    <FeatureGate access={access}>
      {sessions.data.length === 0
        ? <Screen title={title} status="empty" emptyText={t('player.sessions.empty')} />
        : (
          <Screen title={title}>
            <Stack gap={8}>
              {byMonth(sessions.data).map((month) => <Month key={month[0]?.month} sessions={month} onOpen={open} />)}
            </Stack>
          </Screen>
        )}
    </FeatureGate>
  );
}
