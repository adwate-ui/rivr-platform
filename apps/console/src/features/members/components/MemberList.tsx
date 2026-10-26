import { isMemberQuery, useMembersOfTier, useMemberSearch, useVenueTiers, type MemberRow, type VenueTier } from '@rivr/db';
import { formatDate, formatNumber, t } from '@rivr/i18n';
import { Button, ChoiceChips, DataTable, Input, Stack, Text, type DataTableColumn } from '@rivr/ui';
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

/** What the list shows: the members a search found, or every member of a tier; the screen's filters in words. */
interface Listed {
  readonly rows: ReturnType<typeof useMemberSearch>;
  readonly exportFilter: string;
}

/** The members of the tier chosen, narrowed by the search if one is typed; or the search's results alone. */
function useListed(venueId: string, query: string, tier: VenueTier | null): Listed {
  const searched = useMemberSearch(venueId, tier === null ? query : '');
  const ofTier = useMembersOfTier(venueId, tier?.tierId ?? null);
  const typed = query.trim();
  const words = [
    ...(tier === null ? [] : [t('console.exportFilters.choice', { label: t('console.members.tier'), value: tier.name })]),
    ...(typed === '' ? [] : [t('console.members.searchedFor', { query: typed })]),
  ].join('; ');
  return { rows: tier === null ? searched : ofTier, exportFilter: words };
}

/** The list as a table, or its loading or error state; a prompt until a search is typed or a tier chosen. */
function Results({ venueId, query, tier, onOpen }: { venueId: string; query: string; tier: VenueTier | null; onOpen: (memberId: string) => void }) {
  const { rows, exportFilter } = useListed(venueId, query, tier);
  const base = { label: t('console.members.title'), columns: columns(onOpen), rowKey: (row: MemberRow) => row.memberId, exportFilter };
  if (tier === null && !isMemberQuery(query)) return <Text tone="muted">{t('console.members.searchPrompt')}</Text>;
  if (rows.isError) return <DataTable {...base} status="error" onRetry={() => void rows.refetch()} />;
  if (rows.data === undefined) return <DataTable {...base} status="loading" />;
  const typed = query.trim().toLowerCase();
  // Within a tier, the search narrows the tier's members by name, number or mobile number as typed.
  const shown = tier === null || typed === ''
    ? rows.data
    : rows.data.filter((row) => row.fullName.toLowerCase().includes(typed) || String(row.memberNumber) === typed || row.phone?.includes(typed) === true);
  return <DataTable {...base} rows={shown} emptyText={tier === null ? t('console.members.noMatch', { query: query.trim() }) : t('console.members.noneInTier', { tier: tier.name })} />;
}

/** Finds members by name, mobile number or member number, or lists a tier's; a member's name opens their record. */
export function MemberList({ venueId, onOpen }: { venueId: string; onOpen: (memberId: string) => void }) {
  const [query, setQuery] = useState('');
  const [tierId, setTierId] = useState('');
  const tiers = useVenueTiers(venueId);
  const tier = tiers.data?.find((candidate) => candidate.tierId === tierId) ?? null;
  return (
    <Stack gap={4}>
      <Input type="search" label={t('console.members.search')} hint={t('console.members.searchHint')} value={query} autoComplete="off"
        onChange={(event) => setQuery(event.target.value)} />
      {tiers.data === undefined ? null : (
        <ChoiceChips label={t('console.members.filterTier')} mode="one" selected={[tierId]}
          options={[{ value: '', label: t('console.members.anyTier') }, ...tiers.data.map((choice) => ({ value: choice.tierId, label: choice.name }))]}
          onChange={(picked) => setTierId(picked[0] ?? '')} />
      )}
      <Results venueId={venueId} query={query} tier={tier} onOpen={onOpen} />
    </Stack>
  );
}
