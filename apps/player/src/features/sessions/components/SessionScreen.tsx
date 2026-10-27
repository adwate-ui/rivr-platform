import { useFeature } from '@rivr/db';
import { useMySessions, type MySession } from '@rivr/db/sessions';
import { formatDuration, formatTime, t } from '@rivr/i18n';
import { Button, Divider, FeatureGate, Inline, Money, Screen, Stack, Text } from '@rivr/ui';
import { useNavigate, useParams } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { Net } from './Net.tsx';
import { sessionDay, sessionStake, sessionTitle } from './naming.ts';

interface Row {
  label: string;
  value: ReactNode;
  /** A line under the row, such as what the TDS was withheld on. */
  note?: string;
}

/** What the TDS was withheld on, when it was a period's winnings rather than the session's alone (#563). */
function tdsNote(session: MySession): { note?: string } {
  return session.tdsBasis === 'day' || session.tdsBasis === 'financial_year' ? { note: t(`player.sessions.tdsOn.${session.tdsBasis}`) } : {};
}

/** The detail's rows (design prompt, "Sessions"): bonus chips, the TDS and what was paid only when they apply. */
function rowsOf(session: MySession): Row[] {
  const rows: (Row | null)[] = [
    { label: t('player.sessions.stake'), value: <Text>{sessionStake(session)}</Text> },
    {
      label: t('player.sessions.time'),
      value: <Text>{t('player.sessions.timeRange', { from: formatTime(new Date(session.openedAt)), to: formatTime(new Date(session.closedAt)) })}</Text>,
    },
    { label: t('player.sessions.hours'), value: <Text>{formatDuration(session.playedSeconds)}</Text> },
    { label: t('player.sessions.buyIn'), value: <Money paise={session.buyIn} /> },
    session.bonus > 0n ? { label: t('player.sessions.bonus'), value: <Money paise={session.bonus} /> } : null,
    { label: session.kind === 'tournament' ? t('player.sessions.prize') : t('player.sessions.cashOut'), value: <Money paise={session.cashOut} /> },
    session.tds > 0n ? { label: t('player.sessions.tdsLine'), value: <Money paise={session.tds} />, ...tdsNote(session) } : null,
    session.paid === session.cashOut ? null : { label: t('player.sessions.paid'), value: <Money paise={session.paid} /> },
  ];
  return rows.filter((row): row is Row => row !== null);
}

/** One session: when, its rows, the net, and the receipt to find it again at the cage. */
function Detail({ session }: { session: MySession }) {
  return (
    <Stack gap={6}>
      <Text tone="muted">{sessionDay(session)}</Text>
      <Stack gap={3}>
        <Stack gap={3} divided>
          {rowsOf(session).map((row) => (
            <Stack key={row.label} gap={1}>
              <Inline gap={4} align="baseline" justify="between">
                <Text tone="muted">{row.label}</Text>
                {row.value}
              </Inline>
              {row.note === undefined ? null : <Text variant="small" tone="muted">{row.note}</Text>}
            </Stack>
          ))}
          <Inline gap={4} align="baseline" justify="between">
            <Text weight="semibold">{t('player.sessions.net')}</Text>
            <Net paise={session.net} />
          </Inline>
        </Stack>
        <Divider />
      </Stack>
      {session.receipt === null ? null : <Text variant="small" tone="muted">{t('player.sessions.receipt', { reference: session.receipt })}</Text>}
    </Stack>
  );
}

/** A session's detail with its receipt (#127), from the history already loaded; gated as the history is. */
export function SessionScreen() {
  const { visitId = '' } = useParams({ strict: false });
  const sessions = useMySessions();
  const access = useFeature('sessions.history');
  const navigate = useNavigate();
  const back = <Button variant="text" icon="chevronLeft" onClick={() => void navigate({ to: '/sessions' })}>{t('common.back')}</Button>;
  const session = sessions.data?.find((one) => one.visitId === visitId);
  const title = session === undefined ? t('player.sessions.title') : sessionTitle(session);
  if (sessions.isError) return <Screen title={title} actions={back} status="error" onRetry={() => void sessions.refetch()} />;
  if (sessions.data === undefined) return <Screen title={title} actions={back} status="loading" />;
  return (
    <FeatureGate access={access}>
      {session === undefined
        ? <Screen title={title} actions={back} status="empty" emptyText={t('player.sessions.notFound')} />
        : <Screen title={title} actions={back}><Detail session={session} /></Screen>}
    </FeatureGate>
  );
}
