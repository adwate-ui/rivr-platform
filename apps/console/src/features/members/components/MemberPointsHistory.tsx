import { useMemberPointsHistory, type MemberPointsLine } from '@rivr/db/pointsHistory';
import { formatDate, formatNumber, t } from '@rivr/i18n';
import { Button, DetailRow, Heading, LoadState, Stack, Text } from '@rivr/ui';
import { useState } from 'react';

/** Lines shown at first, and how many more each Show earlier adds. */
const PAGE = 20;

/** What a line says: when, what for, and who gave it, when someone did. */
function labelOf(line: MemberPointsLine): string {
  const date = formatDate(new Date(line.at));
  const { reason, staffName: name } = line;
  if (line.kind === 'locked') return name === null ? t('console.members.bonus.points.locked', { date, reason }) : t('console.members.bonus.points.lockedBy', { date, reason, name });
  if (line.kind === 'released') return name === null ? t('console.members.bonus.points.released', { date, reason }) : t('console.members.bonus.points.releasedBy', { date, reason, name });
  return line.staffName === null ? t('console.members.bonus.points.line', { date, reason: line.reason }) : t('console.members.bonus.points.by', { date, reason: line.reason, name: line.staffName });
}

/** The member's points, the newest first (F-017): earned, spent, given by hand, locked and released, with Show earlier. */
export function MemberPointsHistory({ venueId, memberId }: { venueId: string; memberId: string }) {
  const [count, setCount] = useState(PAGE);
  const history = useMemberPointsHistory(venueId, memberId, count);
  const title = <Heading level={3}>{t('console.members.bonus.points.history')}</Heading>;
  if (history.isError) return <Stack gap={2}>{title}<LoadState isError onRetry={() => void history.refetch()} /></Stack>;
  if (history.data === undefined) return <Stack gap={2}>{title}<LoadState /></Stack>;
  const lines = history.data;
  return (
    <Stack gap={2}>
      {title}
      {lines.length === 0 ? <Text tone="muted">{t('console.members.bonus.points.none')}</Text> : null}
      <Stack gap={0}>
        {lines.map((line, index) => (
          <DetailRow key={line.id} size="small" label={labelOf(line)} isLast={index === lines.length - 1} valueTone={line.kind === 'spent' || line.kind === 'locked' ? 'muted' : 'default'}
            value={t(line.kind === 'spent' ? 'console.members.bonus.points.minus' : 'console.members.bonus.points.plus', { points: formatNumber(line.points) })} />
        ))}
      </Stack>
      {lines.length < count ? null : <Button variant="text" size="small" onClick={() => setCount(count + PAGE)}>{t('console.members.bonus.showEarlier')}</Button>}
    </Stack>
  );
}
