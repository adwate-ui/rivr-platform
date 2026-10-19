import { isMemberQuery, useMemberSearch, type MemberRow } from '@rivr/db';
import { formatDate, formatNumber, t } from '@rivr/i18n';
import { Button, DataTable, Input, Stack, Text, type DataTableColumn } from '@rivr/ui';
import { useState } from 'react';

function columns(onOpen: (memberId: string) => void): readonly DataTableColumn<MemberRow>[] {
  return [
    { key: 'number', header: t('console.members.number'), cell: (row) => <Text tone="muted">{String(row.memberNumber)}</Text>, sortValue: (row) => row.memberNumber },
    {
      key: 'name', header: t('console.members.name'), sortValue: (row) => row.fullName,
      cell: (row) => (
        <Button variant="text" aria-label={t('console.members.open', { name: row.fullName })} onClick={() => onOpen(row.memberId)}>{row.fullName}</Button>
      ),
    },
    { key: 'tier', header: t('console.members.tier'), cell: (row) => row.tierName, sortValue: (row) => row.tierName },
    { key: 'visits', header: t('console.members.visits'), cell: (row) => formatNumber(row.visits), sortValue: (row) => row.visits, align: 'end' },
    {
      key: 'last', header: t('console.members.lastVisit'), sortValue: (row) => row.lastVisitAt ?? '', align: 'end',
      cell: (row) => (row.lastVisitAt === null ? <Text tone="muted">{t('console.members.never')}</Text> : formatDate(new Date(row.lastVisitAt))),
    },
  ];
}

/** The search's results as a table, or its loading or error state, once two characters are typed. */
function Results({ venueId, query, onOpen }: { venueId: string; query: string; onOpen: (memberId: string) => void }) {
  const found = useMemberSearch(venueId, query);
  const base = { label: t('console.members.title'), columns: columns(onOpen), rowKey: (row: MemberRow) => row.memberId };
  if (!isMemberQuery(query)) return <Text tone="muted">{t('console.members.searchPrompt')}</Text>;
  if (found.isError) return <DataTable {...base} status="error" onRetry={() => void found.refetch()} />;
  if (found.data === undefined) return <DataTable {...base} status="loading" />;
  return <DataTable {...base} rows={found.data} emptyText={t('console.members.noMatch', { query: query.trim() })} />;
}

/** Finds members by name, mobile number or member number; a member's name opens their record. */
export function MemberList({ venueId, onOpen }: { venueId: string; onOpen: (memberId: string) => void }) {
  const [query, setQuery] = useState('');
  return (
    <Stack gap={4}>
      <Input type="search" label={t('console.members.search')} hint={t('console.members.searchHint')} value={query} autoComplete="off"
        onChange={(event) => setQuery(event.target.value)} />
      <Results venueId={venueId} query={query} onOpen={onOpen} />
    </Stack>
  );
}
