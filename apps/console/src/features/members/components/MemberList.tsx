import { useMembersOfTier, useVenueTiers, type MemberRow, type VenueTier } from '@rivr/db';
import { t } from '@rivr/i18n';
import { ChoiceChips, DataTable, Input, Stack } from '@rivr/ui';
import { useState } from 'react';
import { memberColumns } from './memberColumns.tsx';
import type { Tonight } from './tonight.ts';

/** What the list is given: the venue, where each member is tonight, how a record opens, and where its Export goes. */
interface ListProps {
  readonly venueId: string;
  readonly tonight: ReadonlyMap<string, Tonight>;
  readonly onOpen: (memberId: string) => void;
  /** The element beside the screen's title that holds the table's Export, as the prototype has it; null until it is there. */
  readonly exportIn: HTMLElement | null;
}

/**
 * Whether the search finds a member: their name as typed, their member number exactly, or four or more digits of their
 * mobile number, as the prototype's "last 4 digits".
 */
function isFound(row: MemberRow, query: string): boolean {
  const typed = query.trim().toLowerCase();
  if (typed === '') return true;
  const digits = typed.replace(/\D/g, '');
  return row.fullName.toLowerCase().includes(typed) || String(row.memberNumber) === typed
    || (digits.length >= 4 && row.phone?.includes(digits.slice(-10)) === true);
}

/** The screen's filters in words, as an export records them (#102): "All members" when nothing narrows the list. */
function filterWords(query: string, tier: VenueTier | null): string {
  const typed = query.trim();
  const words = [
    ...(tier === null ? [] : [t('console.exportFilters.choice', { label: t('console.members.tier'), value: tier.name })]),
    ...(typed === '' ? [] : [t('console.members.searchedFor', { query: typed })]),
  ];
  return words.length === 0 ? t('console.members.allMembers') : words.join('; ');
}

/** Why the list is empty: nothing matches the search, the tier has nobody, or the venue has no members yet. */
function emptyText(query: string, tier: VenueTier | null): string {
  if (query.trim() !== '') return t('console.members.noMatch', { query: query.trim() });
  return tier === null ? t('console.members.none') : t('console.members.noneInTier', { tier: tier.name });
}

/** Every member, or a tier's, as a table, narrowed by the search as typed; or its loading or error state. */
function Results({ venueId, tonight, onOpen, exportIn, query, tier }: ListProps & { query: string; tier: VenueTier | null }) {
  const listed = useMembersOfTier(venueId, tier?.tierId ?? null);
  const base = {
    label: t('console.members.title'), columns: memberColumns(tonight), rowKey: (row: MemberRow) => row.memberId, exportFilter: filterWords(query, tier),
    onRowOpen: (row: MemberRow) => onOpen(row.memberId), initialSort: { key: 'name', direction: 'ascending' } as const, exportIn,
    // On a phone the table's lines scroll sideways under the names, as in the prototype.
    narrowLayout: 'scroll' as const,
  };
  if (listed.isError) return <DataTable {...base} status="error" onRetry={() => void listed.refetch()} />;
  if (listed.data === undefined) return <DataTable {...base} status="loading" />;
  return <DataTable {...base} rows={listed.data.filter((row) => isFound(row, query))} emptyText={emptyText(query, tier)} />;
}

/**
 * Every member of the venue, listed on open (owner, 3 Nov; decision 0483), as console v3 draws it: the search and a tier
 * choice narrow the table of Name, No., Tier, Tonight and Visits; a click on a row opens the member's record.
 */
export function MemberList({ venueId, tonight, onOpen, exportIn }: ListProps) {
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
      <Results venueId={venueId} tonight={tonight} onOpen={onOpen} exportIn={exportIn} query={query} tier={tier} />
    </Stack>
  );
}
