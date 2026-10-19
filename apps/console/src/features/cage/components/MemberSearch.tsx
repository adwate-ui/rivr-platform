import { useCageMembers, type CageMember } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, ErrorMessage, Input, Stack, Text } from '@rivr/ui';
import { useState } from 'react';

/** Finds members by name or mobile number; choosing one opens them beside, read again from the same search as it changes. */
export function MemberSearch({ venueId, onChoose }: { venueId: string; onChoose: (member: CageMember, query: string) => void }) {
  const [query, setQuery] = useState('');
  const members = useCageMembers(venueId, query);
  return (
    <Stack gap={2}>
      <Input label={t('console.cage.search')} value={query} onChange={(event) => setQuery(event.target.value)} autoComplete="off" />
      {members.fetchStatus === 'fetching' && members.data === undefined ? <Text tone="muted">{t('common.loading')}</Text> : null}
      {members.isError ? (
        <Stack gap={2} align="start">
          <ErrorMessage>{t('console.cage.unavailable')}</ErrorMessage>
          <Button onClick={() => void members.refetch()}>{t('common.retry')}</Button>
        </Stack>
      ) : null}
      {members.data?.length === 0 ? <Text tone="muted">{t('console.cage.noMatch')}</Text> : null}
      {(members.data ?? []).map((member) => (
        <Button key={member.memberId} variant="text" onClick={() => onChoose(member, query)}>{member.fullName}</Button>
      ))}
    </Stack>
  );
}
