import {
  MEMBERS_PAGE, useEveryMember, useMemberAccountStatuses, useMemberChoices, useMembersPage, useVenueTiers, type MemberListRow, type MembersView, type VenueTier,
} from '@rivr/db';
import { t } from '@rivr/i18n';
import { ChoiceChips, DataTable, Sheet, Stack, type DataTableRequest } from '@rivr/ui';
import { useState, type ReactNode } from 'react';
import { useAddressWords } from './addressWords.ts';
import { filtersInCodes } from './memberChoices.ts';
import { memberColumns } from './memberColumns.tsx';
import { memberExportColumns } from './memberExportColumns.ts';
import { MemberStaffHistory } from './MemberStaffHistory.tsx';
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
  /** Floor and up (members.phone) open a member's History of changes by staff from their row, as the Door's History. */
  readonly seesHistory: boolean;
}

/** The tier chosen in words, as an export records it with the table's own search and filters (#102); none for every tier. */
function tierWords(tier: VenueTier | null): string | undefined {
  return tier === null ? undefined : t('console.exportFilters.choice', { label: t('console.members.tier'), value: tier.name });
}

/** Why the list is empty: the tier has nobody, or the venue has no members yet. */
function emptyText(tier: VenueTier | null): string {
  return tier === null ? t('console.members.none') : t('console.members.noneInTier', { tier: tier.name });
}

/** The view the server is asked for: the table's, its chosen values as the server's codes, and the tier; none until the table hands its own over. */
function viewOf(request: DataTableRequest | null, tier: VenueTier | null): MembersView | null {
  return request === null ? null : { ...request, filters: filtersInCodes(request.filters), tierId: tier?.tierId ?? null };
}

/** What the list's table is given besides the list's own: the tier chosen, the tier chips, and how a row's History opens. */
interface ResultsExtra {
  readonly tier: VenueTier | null;
  readonly tiers: ReactNode;
  readonly onHistory: ((row: MemberListRow) => void) | undefined;
}

/** A member's History in the panel at the side, as the Door's (#1073), while one is open. */
function HistoryPanel({ venueId, opened, onClose }: { venueId: string; opened: MemberListRow | null; onClose: () => void }) {
  if (opened === null) return null;
  return <Sheet place="console" isOpen onClose={onClose} title={opened.fullName}><MemberStaffHistory venueId={venueId} memberId={opened.memberId} /></Sheet>;
}

/**
 * One page of the members the view leaves, as a table with the search above it and the tiers beside it (redesign RD-29):
 * the server sorts, searches, filters and pages, and counts what each column's menu offers. The search finds a name by
 * any part, a member number exactly, or four or more digits of a mobile. Export reads every member the view leaves.
 */
function Results({ venueId, tonight, onOpen, exportIn, seesPhone, seesIdentity, isDocked, tier, tiers, onHistory }: Omit<ListProps, 'seesHistory'> & ResultsExtra) {
  // The table's view as it last handed it over; none until it is first drawn.
  const [request, setRequest] = useState<DataTableRequest | null>(null);
  const view = viewOf(request, tier);
  const listed = useMembersPage(venueId, view);
  const choices = useMemberChoices(venueId, view).data;
  const everyMember = useEveryMember(venueId);
  const statuses = useMemberAccountStatuses(venueId).data;
  const chosen = tierWords(tier);
  const base = {
    label: t('console.members.title'), columns: memberColumns(tonight, { seesPhone, statuses, choices, onHistory }), rowKey: (row: MemberListRow) => row.memberId, scrollsSideways: isDocked,
    filter: { label: t('console.members.search'), variant: 'subtle' as const, text: (row: MemberListRow) => row.fullName }, belowSearch: tiers,
    ...(chosen === undefined ? {} : { exportFilter: chosen }), exportColumns: memberExportColumns(seesIdentity),
    onRowOpen: (row: MemberListRow) => onOpen(row.memberId), initialSort: { key: 'name', direction: 'ascending' } as const, exportIn,
    // On a phone the table's lines scroll sideways under the names, as in the prototype.
    narrowLayout: 'scroll' as const,
    server: { total: listed.data?.total ?? 0, pageSize: MEMBERS_PAGE, onRequest: setRequest, scope: tier?.tierId ?? '' },
    exportRows: async () => (view === null ? [] : everyMember(view)),
  };
  if (listed.isError) return <DataTable {...base} status="error" onRetry={() => void listed.refetch()} />;
  if (listed.data === undefined) return <DataTable {...base} status="loading" />;
  return <DataTable {...base} rows={listed.data.rows} emptyText={emptyText(tier)} />;
}

/**
 * Every member of the venue, listed on open (owner, 3 Nov; decision 0483), as console v3 draws it: the search and a tier
 * choice narrow the table of Name, No., Tier, ID check, Hours, City, Joined, Tonight, Visits and Bonus, with the mobile
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
  const [opened, setOpened] = useState<MemberListRow | null>(null);
  const { seesHistory, ...shown } = props;
  return (
    <Stack gap={0}>
      <Results {...shown} tier={tier} tiers={chips} onHistory={seesHistory ? setOpened : undefined} />
      <HistoryPanel venueId={props.venueId} opened={opened} onClose={() => setOpened(null)} />
    </Stack>
  );
}
