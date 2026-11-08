import { useMembersOfTier, useVenueTiers, type MemberListRow, type VenueTier } from '@rivr/db';
import { t, formatNumber } from '@rivr/i18n';
import { ChoiceChips, DataTable, Text } from '@rivr/ui';
import type { ReactNode } from 'react';
import { useAddressWords } from './addressWords.ts';
import { memberColumns } from './memberColumns.tsx';
import { memberExportColumns } from './memberExportColumns.ts';
import type { Tonight } from './tonight.ts';

/** What the list is given: the venue, where each member is tonight, how a record opens, and where its Export goes. */
interface ListProps {
  readonly venueId: string;
  readonly tonight: ReadonlyMap<string, Tonight>;
  readonly onOpen: (memberId: string) => void;
  /** The element beside the screen's title that holds the table's Export, as the prototype has it; null until it is there. */
  readonly exportIn: HTMLElement | null;
  /** Super admins (members.change_phone) see each full mobile number; other staff only search by its last four digits. */
  readonly seesPhone: boolean;
  /** Super admins export members' identity documents (the owner, 9 Nov). */
  readonly seesIdentity: boolean;
  /** A record is open beside the list, so it has half the width: every column kept, the lines scrolling sideways (owner, 9 Nov). */
  readonly isDocked: boolean;
}

/** Whether four or more digits typed match the mobile: within the full number, or by its last four digits for staff without it. */
function isPhoneFound(row: MemberListRow, digits: string): boolean {
  if (digits.length < 4) return false;
  return row.phone === null ? row.phoneLast4 === digits.slice(-4) : row.phone.includes(digits.slice(-10));
}

/**
 * Whether the search finds a member: their name as typed, their member number exactly, or four or more digits of their
 * mobile number, as the prototype's "last 4 digits".
 */
function isFound(row: MemberListRow, query: string): boolean {
  const typed = query.trim().toLowerCase();
  if (typed === '') return true;
  return row.fullName.toLowerCase().includes(typed) || String(row.memberNumber) === typed || isPhoneFound(row, typed.replace(/\D/g, ''));
}

/** The tier chosen in words, as an export records it with the table's own search and filters (#102); none for every tier. */
function tierWords(tier: VenueTier | null): string | undefined {
  return tier === null ? undefined : t('console.exportFilters.choice', { label: t('console.members.tier'), value: tier.name });
}

/** Why the list is empty: the tier has nobody, or the venue has no members yet. */
function emptyText(tier: VenueTier | null): string {
  return tier === null ? t('console.members.none') : t('console.members.noneInTier', { tier: tier.name });
}

/** How many the list shows, beside the search, once the rows are in (audit F-095). */
function memberTotal(rows: readonly MemberListRow[]) {
  return <Text variant="secondary" tone="muted">{rows.length === 1 ? t('console.members.totalOne') : t('console.members.total', { count: formatNumber(rows.length) })}</Text>;
}

/**
 * Every member, or a tier's, as a table with the search above it and the tiers beside it; or its loading or error state.
 * The search is the table's (owner, 9 Nov): kept in the address, a pill, counted and cleared with its filters.
 */
function Results({ venueId, tonight, onOpen, exportIn, seesPhone, seesIdentity, isDocked, tier, tiers }: ListProps & { tier: VenueTier | null; tiers: ReactNode }) {
  const listed = useMembersOfTier(venueId, tier?.tierId ?? null);
  const chosen = tierWords(tier);
  const base = {
    label: t('console.members.title'), columns: memberColumns(tonight, { seesPhone }), rowKey: (row: MemberListRow) => row.memberId, scrollsSideways: isDocked,
    filter: { label: t('console.members.search'), variant: 'subtle' as const, matches: isFound }, belowSearch: tiers,
    ...(chosen === undefined ? {} : { exportFilter: chosen }), exportColumns: memberExportColumns(seesIdentity),
    onRowOpen: (row: MemberListRow) => onOpen(row.memberId), initialSort: { key: 'name', direction: 'ascending' } as const, exportIn,
    // On a phone the table's lines scroll sideways under the names, as in the prototype.
    narrowLayout: 'scroll' as const,
  };
  if (listed.isError) return <DataTable {...base} status="error" onRetry={() => void listed.refetch()} />;
  if (listed.data === undefined) return <DataTable {...base} status="loading" />;
  return <DataTable {...base} rows={listed.data} emptyText={emptyText(tier)} toolbar={memberTotal} />;
}

/**
 * Every member of the venue, listed on open (owner, 3 Nov; decision 0483), as console v3 draws it: the search and a tier
 * choice narrow the table of Name, No., Tier, KYC, Hours played, City, Member since, Tonight and Visits, with the mobile
 * for super admins (owner, 8 Nov); a click on a row opens the member's record.
 */
export function MemberList(props: ListProps) {
  // The tier is kept in the address, as the table's view is, so it stays as a record opens, on a reload and with Back.
  const [tierId, setTierId] = useAddressWords('tier');
  const tiers = useVenueTiers(props.venueId);
  const tier = tiers.data?.find((candidate) => candidate.tierId === tierId) ?? null;
  // No select in @rivr/ui (ui.md): the tiers are a row of chips, which scrolls sideways on a phone.
  const chips = tiers.data === undefined ? null : (
    <ChoiceChips label={t('console.members.filterTier')} isLabelVisuallyHidden mode="one" look="subtle" isOneRow selected={[tierId]}
      options={[{ value: '', label: t('console.members.anyTier') }, ...tiers.data.map((choice) => ({ value: choice.tierId, label: choice.name }))]}
      onChange={(picked) => setTierId(picked[0] ?? '')} />
  );
  return <Results {...props} tier={tier} tiers={chips} />;
}
