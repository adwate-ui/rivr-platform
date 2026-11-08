import type { MemberKycStatus, MemberListRow } from '@rivr/db';
import { formatHoursMinutes, formatMobile, formatMonthYear, formatNumber, t } from '@rivr/i18n';
import { DotStatus, Text, type DataTableColumn, type DotStatusTone } from '@rivr/ui';
import type { Tonight } from './tonight.ts';

/** A member's place tonight as a dot and a short status (console v3): a seat, waiting, left, or a dash when not here. */
export function TonightStatus({ tonight }: { tonight: Tonight | undefined }) {
  if (tonight === undefined) return <Text variant="secondary" tone="muted">{t('console.members.notHere')}</Text>;
  if (tonight.kind === 'seated') {
    const seat = { table: tonight.tableName, seat: tonight.seat };
    return <DotStatus tone="active" label={t('console.members.seatShort', seat)} title={t('console.members.seatFull', seat)} />;
  }
  // Waiting is gold, as on the door's list of today's players: someone at the club without a seat yet.
  return tonight.kind === 'waiting'
    ? <DotStatus tone="needsYou" label={t('console.members.waiting')} />
    : <DotStatus tone="inactive" label={t('console.members.left')} />;
}

/** Seated first, by table and seat, then waiting, left, and members not at the club. */
function tonightOrder(tonight: Tonight | undefined): string {
  if (tonight === undefined) return '3';
  if (tonight.kind === 'seated') return `0 ${tonight.tableName} ${String(tonight.seat).padStart(2, '0')}`;
  return tonight.kind === 'waiting' ? '1' : '2';
}

// Verified is cream; a check someone must do is gold; refused is red; not done faint.
const KYC_TONE: Readonly<Record<MemberKycStatus, DotStatusTone>> = {
  verified: 'active', in_review: 'needsYou', at_desk: 'needsYou', refused: 'danger', not_done: 'inactive',
};
const KYC_ORDER: readonly MemberKycStatus[] = ['at_desk', 'in_review', 'not_done', 'refused', 'verified'];

/**
 * The mobile number, for super admins only (owner, 8 Nov): staff without members.change_phone have no such column. Two
 * shares, so a number stays on one line beside the other columns at 1440 px.
 */
const mobileColumn: DataTableColumn<MemberListRow> = {
  key: 'mobile', header: t('console.members.mobile'), priority: 'secondary', isWide: true,
  cell: (row) => (row.phone === null ? '' : formatMobile(row.phone)), exportValue: (row) => row.phone ?? '',
};

/** KYC, time played, city and the day they joined (owner, 8 Nov); city and joining day give way first on a narrow screen. */
function moreColumns(): readonly DataTableColumn<MemberListRow>[] {
  return [
    {
      key: 'kyc', header: t('console.members.kyc'), sortValue: (row) => KYC_ORDER.indexOf(row.kycStatus), filter: 'choice',
      filterValue: (row) => t(`console.members.kycStatuses.${row.kycStatus}`),
      cell: (row) => <DotStatus tone={KYC_TONE[row.kycStatus]} label={t(`console.members.kycStatuses.${row.kycStatus}`)} />,
      exportValue: (row) => t(`console.members.kycStatuses.${row.kycStatus}`),
    },
    {
      key: 'played', header: t('console.members.played'), align: 'end', sortValue: (row) => row.minutesPlayed,
      cell: (row) => formatHoursMinutes(row.minutesPlayed * 60),
    },
    { key: 'city', header: t('console.members.city'), priority: 'optional', cell: (row) => row.city ?? '', sortValue: (row) => row.city ?? '', filter: 'choice' },
    {
      key: 'since', header: t('console.members.memberSince'), priority: 'optional', sortValue: (row) => row.memberSince,
      cell: (row) => formatMonthYear(new Date(row.memberSince)),
    },
  ];
}

/** How the list is drawn: whether the viewer sees full numbers, and whether a record is open beside it, half the width. */
export interface MemberColumnsFor {
  readonly seesPhone: boolean;
  readonly isDocked: boolean;
}

/**
 * Members' columns (console v3; owner, 8 Nov): Name, No., Tier, the mobile for super admins, KYC, Hours played, City,
 * Member since, Tonight and Visits; the name opens the record. With a record open beside the list, only Name, No., Tier,
 * Tonight and Visits, which fit half the width; the record has the rest.
 */
export function memberColumns(tonight: ReadonlyMap<string, Tonight>, view: MemberColumnsFor): readonly DataTableColumn<MemberListRow>[] {
  const [name, number, tier, ...rest] = coreColumns(tonight);
  const more = view.isDocked ? [] : [...(view.seesPhone ? [mobileColumn] : []), ...moreColumns()];
  return [name, number, tier, ...more, ...rest].filter((column) => column !== undefined);
}

/** Name, No., Tier, Tonight and Visits: the list as console v3 drew it. */
function coreColumns(tonight: ReadonlyMap<string, Tonight>): readonly DataTableColumn<MemberListRow>[] {
  return [
    // Twice a share, so a name stays on one line beside the record (the screenshot index: "Kabir / Sethi").
    { key: 'name', header: t('console.members.name'), cell: (row) => row.fullName, sortValue: (row) => row.fullName, isWide: true },
    { key: 'number', header: t('console.members.number'), cell: (row) => <Text variant="secondary" tone="muted">{String(row.memberNumber)}</Text>, sortValue: (row) => row.memberNumber },
    { key: 'tier', header: t('console.members.tier'), cell: (row) => row.tierName, sortValue: (row) => row.tierName },
    {
      key: 'tonight', header: t('console.members.tonight'), cell: (row) => <TonightStatus tonight={tonight.get(row.memberId)} />,
      sortValue: (row) => tonightOrder(tonight.get(row.memberId)), exportValue: (row) => tonightWords(tonight.get(row.memberId)), filter: 'choice',
      filterValue: (row) => tonightWords(tonight.get(row.memberId)) || t('console.members.notHere'),
    },
    { key: 'visits', header: t('console.members.visits'), cell: (row) => formatNumber(row.visits), sortValue: (row) => row.visits, align: 'end' },
  ];
}

/** Tonight in words for an export: `Table 2, seat 3`, `Waiting` or `Left`. */
function tonightWords(tonight: Tonight | undefined): string {
  if (tonight === undefined) return '';
  if (tonight.kind === 'seated') return t('console.members.seatFull', { table: tonight.tableName, seat: tonight.seat });
  return t(tonight.kind === 'waiting' ? 'console.members.waiting' : 'console.members.left');
}
