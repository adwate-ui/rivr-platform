import { isMemberQuery, useMembersOfTier, useMemberSearch, useVenueTiers, type MemberRow, type VenueTier } from '@rivr/db';
import { t } from '@rivr/i18n';
import { ChoiceChips, DataTable, Input, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { memberColumns } from './memberColumns.tsx';
import type { Tonight } from './tonight.ts';

/** What the list is given: the venue, where each member is tonight, and how a record opens. */
interface ListProps {
  readonly venueId: string;
  readonly tonight: ReadonlyMap<string, Tonight>;
  readonly onOpen: (memberId: string) => void;
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
function Results({ venueId, tonight, onOpen, query, tier }: ListProps & { query: string; tier: VenueTier | null }) {
  const { rows, exportFilter } = useListed(venueId, query, tier);
  const base = {
    label: t('console.members.title'), columns: memberColumns(tonight), rowKey: (row: MemberRow) => row.memberId, exportFilter,
    onRowOpen: (row: MemberRow) => onOpen(row.memberId), initialSort: { key: 'name', direction: 'ascending' } as const,
  };
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

/**
 * Finds members by name, mobile number or member number, or lists a tier's (console v3: the search, a tier choice and the
 * table of Name, No., Tier, Tonight and Visits); a click on a row opens the member's record.
 */
export function MemberList({ venueId, tonight, onOpen }: ListProps) {
  const [query, setQuery] = useState('');
  const [tierId, setTierId] = useState('');
  const tiers = useVenueTiers(venueId);
  const tier = tiers.data?.find((candidate) => candidate.tierId === tierId) ?? null;
  return (
    <Stack gap={4}>
      <Input type="search" variant="subtle" label={t('console.members.search')} value={query} autoComplete="off"
        onChange={(event) => setQuery(event.target.value)} />
      {/* No select in @rivr/ui (ui.md): the tiers are a row of chips, which scrolls sideways on a phone. */}
      {tiers.data === undefined ? null : (
        <ChoiceChips label={t('console.members.filterTier')} isLabelVisuallyHidden mode="one" look="subtle" isOneRow selected={[tierId]}
          options={[{ value: '', label: t('console.members.anyTier') }, ...tiers.data.map((choice) => ({ value: choice.tierId, label: choice.name }))]}
          onChange={(picked) => setTierId(picked[0] ?? '')} />
      )}
      <Results venueId={venueId} tonight={tonight} onOpen={onOpen} query={query} tier={tier} />
    </Stack>
  );
}
