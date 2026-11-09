import { useMemberVisits, type MemberVisit } from '@rivr/db';
import { formatDate, formatDuration, t } from '@rivr/i18n';
import { Button, DetailRow, Heading, LoadState, Stack, Text } from '@rivr/ui';
import { useState } from 'react';

/** Lines shown at first, and how many more each Show earlier adds. */
const PAGE = 20;

/** Whether the call time owed was met, and whether they left early, in words; empty when neither applies. */
function flagsOf(visit: MemberVisit): string {
  const callTime = visit.callTimeMet === null ? [] : [t(visit.callTimeMet ? 'console.members.visitHistory.callTimeMet' : 'console.members.visitHistory.callTimeOwed')];
  return [...callTime, ...(visit.leftEarly ? [t('console.members.visitHistory.leftEarly')] : [])].join(' · ');
}

function VisitLine({ visit, isLast }: { visit: MemberVisit; isLast: boolean }) {
  const flags = flagsOf(visit);
  return (
    <Stack gap={0}>
      <DetailRow size="small" isLast={isLast && flags === ''} value={formatDuration(visit.minutesPlayed * 60)}
        label={t('console.members.visitHistory.line', { date: formatDate(new Date(visit.openedAt)), tables: visit.tables ?? t('console.members.visitHistory.noTable') })} />
      {flags === '' ? null : <Text variant="caption" tone="muted">{flags}</Text>}
    </Stack>
  );
}

/** Each visit on the record (F-017), newest first: its day, tables, time played, the call time owed and whether they left early. */
export function MemberVisits({ venueId, memberId }: { venueId: string; memberId: string }) {
  const [count, setCount] = useState(PAGE);
  const visits = useMemberVisits(venueId, memberId, count);
  const title = <Heading level={3}>{t('console.members.visitHistory.title')}</Heading>;
  if (visits.isError) return <Stack gap={2}>{title}<LoadState isError onRetry={() => void visits.refetch()} /></Stack>;
  if (visits.data === undefined) return <Stack gap={2}>{title}<LoadState /></Stack>;
  const lines = visits.data;
  return (
    <Stack gap={2}>
      {title}
      {lines.length === 0 ? <Text tone="muted">{t('console.members.visitHistory.none')}</Text> : null}
      <Stack gap={1}>{lines.map((visit, index) => <VisitLine key={visit.visitId} visit={visit} isLast={index === lines.length - 1} />)}</Stack>
      {lines.length < count ? null : <Button variant="text" size="small" onClick={() => setCount(count + PAGE)}>{t('console.members.bonus.showEarlier')}</Button>}
    </Stack>
  );
}
