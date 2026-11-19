import { useMemberStaffHistory, type MemberStaffChange } from '@rivr/db';
import { formatDateTime, t } from '@rivr/i18n';
import { Button, Heading, LoadState, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { fieldLines, whatWords } from './staffChangeWords.ts';

/** Changes shown at first, and how many more each Show earlier adds. */
const PAGE = 20;

/** One change: what it was, who made it and when, each field before and after, and the reason given. */
function ChangeEntry({ change }: { change: MemberStaffChange }) {
  return (
    <Stack gap={1}>
      <Text weight="medium">{whatWords(change)}</Text>
      <Text variant="caption" tone="muted">{t('console.members.staffHistory.byline', { who: change.who, at: formatDateTime(new Date(change.at)) })}</Text>
      {fieldLines(change).map((line) => <Text key={line} variant="secondary">{line}</Text>)}
      {change.reason === null ? null : <Text variant="secondary" tone="muted">{t('console.members.staffHistory.reason', { reason: change.reason })}</Text>}
    </Stack>
  );
}

/**
 * A member's History from the Members table (the owner, 19 Nov): every change staff made about them, newest first, each
 * with who, when, what, the fields before and after, and why; Show earlier reads more.
 */
export function MemberStaffHistory({ venueId, memberId }: { venueId: string; memberId: string }) {
  const [count, setCount] = useState(PAGE);
  const changes = useMemberStaffHistory(venueId, memberId, count);
  const title = <Heading level={3}>{t('console.members.staffHistory.title')}</Heading>;
  if (changes.isError) return <Stack gap={2}>{title}<LoadState isError onRetry={() => void changes.refetch()} /></Stack>;
  if (changes.data === undefined) return <Stack gap={2}>{title}<LoadState /></Stack>;
  const list = changes.data;
  return (
    <Stack gap={3}>
      {title}
      {list.length === 0 ? <Text tone="muted">{t('console.members.staffHistory.none')}</Text> : null}
      <Stack gap={4} divided>{list.map((change) => <ChangeEntry key={change.id} change={change} />)}</Stack>
      {list.length < count ? null : <Button variant="text" size="small" onClick={() => setCount(count + PAGE)}>{t('console.members.bonus.showEarlier')}</Button>}
    </Stack>
  );
}
