import { useFeature } from '@rivr/db';
import { useMySessions, type MySession } from '@rivr/db/sessions';
import { useMyTdsCertificates, type TdsCertificate } from '@rivr/db/tds';
import { formatDate, formatDuration, formatMoney, formatMonth, formatNumber, formatQuarter, formatStakes, t } from '@rivr/i18n';
import { FeatureGate, Heading, HistoryRow, Inline, Screen, Stack, Text } from '@rivr/ui';
import { useNavigate } from '@tanstack/react-router';
import { Net } from './Net.tsx';
import { sessionTitle } from './sessionTitle.ts';

/** One quarter's TDS from one venue: when, who withheld it and their TAN, and how much from how many payments: cash-outs, tournament prizes and bounties. */
function Certificate({ certificate }: { certificate: TdsCertificate }) {
  return (
    <Stack gap={1}>
      <Text weight="medium">
        {t('player.sessions.tdsFrom', {
          quarter: formatQuarter(certificate.quarterStart), legalName: certificate.legalName, tan: certificate.tan ?? t('player.sessions.noTan'),
        })}
      </Text>
      <Text variant="small" tone="muted">
        {t('player.sessions.tdsAmount', { tds: formatMoney(certificate.tds), section: certificate.section, count: formatNumber(certificate.payments) })}
      </Text>
    </Stack>
  );
}

/** TDS certificate data (#93; decision 0169), whenever TDS was withheld, whatever the member's tier: a member is owed it. */
function Certificates({ certificates }: { certificates: readonly TdsCertificate[] }) {
  if (certificates.length === 0) return null;
  return (
    <Stack gap={4}>
      <Heading level={2}>{t('player.sessions.tds')}</Heading>
      <Stack gap={4} divided>
        {certificates.map((certificate) => (
          <Certificate key={`${certificate.venueId}:${certificate.quarterStart}:${certificate.section}`} certificate={certificate} />
        ))}
      </Stack>
    </Stack>
  );
}

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

/** One club month: its name and net, how many sessions and hours, then each session, which opens to its detail. */
function Month({ sessions, onOpen }: { sessions: readonly MySession[]; onOpen: (visitId: string) => void }) {
  const [first] = sessions;
  if (first === undefined) return null;
  const hours = formatDuration(first.monthPlayedSeconds);
  return (
    <Stack gap={2}>
      <Inline gap={4} align="baseline" justify="between">
        <Heading level={2}>{formatMonth(first.month)}</Heading>
        <Net paise={first.monthNet} />
      </Inline>
      <Text variant="small" tone="muted">
        {first.monthSessions === 1
          ? t('player.sessions.monthSummaryOne', { hours })
          : t('player.sessions.monthSummary', { count: formatNumber(first.monthSessions), hours })}
      </Text>
      <Stack divided>
        {sessions.map((session) => (
          <HistoryRow key={session.visitId} when={formatDate(new Date(session.openedAt))} title={sessionTitle(session)}
            value={<Net paise={session.net} />}
            detail={t('player.sessions.sub', { stakes: formatStakes(session.smallBlind, session.bigBlind), hours: formatDuration(session.playedSeconds) })}
            onOpen={() => onOpen(session.visitId)} />
        ))}
      </Stack>
    </Stack>
  );
}

/** The history by club month (#127), or that there is none yet. */
function History({ sessions }: { sessions: readonly MySession[] }) {
  const navigate = useNavigate();
  if (sessions.length === 0) return <Text tone="muted">{t('player.sessions.empty')}</Text>;
  const open = (visitId: string) => void navigate({ to: '/sessions/$visitId', params: { visitId } });
  return (
    <Stack gap={8}>
      {byMonth(sessions).map((month) => <Month key={month[0]?.month} sessions={month} onOpen={open} />)}
    </Stack>
  );
}

/**
 * Sessions: the member's history by visit, gated by tier (feature sessions.history), with each club month's totals;
 * then their TDS certificate data, which shows whatever their tier.
 */
export function SessionsScreen() {
  const sessions = useMySessions();
  const certificates = useMyTdsCertificates();
  const access = useFeature('sessions.history');
  const title = t('player.sessions.title');
  const retry = () => {
    void sessions.refetch();
    void certificates.refetch();
  };
  if (sessions.isError || certificates.isError) return <Screen title={title} status="error" onRetry={retry} />;
  if (sessions.data === undefined || certificates.data === undefined) return <Screen title={title} status="loading" />;
  if (sessions.data.length === 0 && certificates.data.length === 0) {
    return (
      <FeatureGate access={access}>
        <Screen title={title} status="empty" emptyText={t('player.sessions.empty')} />
      </FeatureGate>
    );
  }
  return (
    <Screen title={title}>
      <Stack gap={8}>
        <FeatureGate access={access}>
          <History sessions={sessions.data} />
        </FeatureGate>
        <Certificates certificates={certificates.data} />
      </Stack>
    </Screen>
  );
}
