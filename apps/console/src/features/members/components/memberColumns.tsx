import type { MemberAccountStatus, MemberChoices, MemberKycStatus, MemberListRow } from '@rivr/db';
import { formatChips, formatDate, formatDuration, formatMobile, formatNumber, formatRupeesForFile, t } from '@rivr/i18n';
import { Button, DotStatus, Text, type DataTableColumn, type DotStatusTone } from '@rivr/ui';
import { choicesIn } from './memberChoices.ts';
import type { Tonight } from './tonight.ts';

/** A member's place tonight as a dot and a short status (console v3): a seat, waiting, left, or a dash when not here. */
export function TonightStatus({ tonight }: { tonight: Tonight | undefined }) {
  if (tonight === undefined) return <Text variant="secondary" tone="muted">{t('console.members.notHere')}</Text>;
  if (tonight.kind === 'seated') {
    const seat = { table: tonight.tableName, seat: tonight.seat };
    return <DotStatus tone="active" label={t('console.members.seatFull', seat)} />;
  }
  // Waiting is gold, as on the door's list of today's players: someone at the club without a seat yet.
  if (tonight.kind === 'in_room') return <DotStatus tone="active" label={t('console.members.inRoom')} />;
  return tonight.kind === 'waiting'
    ? <DotStatus tone="needsYou" label={t('console.members.waiting')} />
    : <DotStatus tone="inactive" label={t('console.members.left')} />;
}

/** An account that is not simply active stands out: a break needs staff's eye, and frozen or erased stops the member. */
const ACCOUNT_TONE: Readonly<Record<MemberAccountStatus['state'], DotStatusTone>> = { on_break: 'needsYou', frozen: 'danger', erased: 'danger' };

/** An account's state alone, as its filter reads it. */
const accountKind = (status: MemberAccountStatus | undefined): string => t(`console.members.accountStatus.${status?.state ?? 'active'}`);

/** An account's state in words, a break with its last day. */
function accountWords(status: MemberAccountStatus | undefined): string {
  if (status?.state !== 'on_break' || status.until === null) return accountKind(status);
  return t('console.members.accountStatus.on_breakUntil', { date: formatDate(new Date(status.until)) });
}

/** The same, short enough for the list's column at 1440 px, where a date does not fit: `Break`. */
function accountShort(status: MemberAccountStatus | undefined): string {
  return status?.state === 'on_break' ? t('console.members.accountStatus.on_breakShort') : accountKind(status);
}

/** How an account stands, as a dot and words (F-121); on the list, short, with the full words as its title. */
export function AccountStatusDot({ status, isShort = false }: { status: MemberAccountStatus | undefined; isShort?: boolean }) {
  const tone = status === undefined ? 'active' : ACCOUNT_TONE[status.state];
  const words = accountWords(status);
  const label = isShort ? accountShort(status) : words;
  return <DotStatus tone={tone} label={label} title={label === words ? undefined : words} />;
}

/** Status on the list; a dash until the statuses are read, so a failed read never calls a frozen or erased member active. */
function accountColumn(statuses: ReadonlyMap<string, MemberAccountStatus> | undefined, choices: MemberChoices | undefined): DataTableColumn<MemberListRow> {
  const kindOf = (row: MemberListRow) => (statuses === undefined ? t('console.members.notHere') : accountKind(statuses.get(row.memberId)));
  return {
    key: 'status', share: 1, header: t('console.members.accountStatus.header'), filter: 'choice', choices: choicesIn('status', choices), filterValue: kindOf, sortValue: kindOf,
    exportValue: (row) => (statuses === undefined ? '' : accountWords(statuses.get(row.memberId))),
    cell: (row) => (statuses === undefined ? <Text variant="secondary" tone="muted">{t('console.members.notHere')}</Text> : <AccountStatusDot status={statuses.get(row.memberId)} isShort />),
  };
}

/** Seated first, by table and seat, then waiting, in the room, left, and members not at the club. */
function tonightOrder(tonight: Tonight | undefined): string {
  if (tonight === undefined) return '4';
  if (tonight.kind === 'seated') return `0 ${tonight.tableName} ${String(tonight.seat).padStart(2, '0')}`;
  if (tonight.kind === 'in_room') return '2';
  return tonight.kind === 'waiting' ? '1' : '3';
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
  key: 'mobile', share: 1.75, header: t('console.members.mobile'), priority: 'secondary', isWide: true, filter: 'text',
  cell: (row) => (row.phone === null ? '' : formatMobile(row.phone)), exportValue: (row) => row.phone ?? '',
};

/** KYC, time played, city and the day they joined (owner, 8 Nov); city and joining day give way first on a narrow screen. */
function moreColumns(choices: MemberChoices | undefined): readonly DataTableColumn<MemberListRow>[] {
  return [
    {
      key: 'kyc', share: 1.3, header: t('console.members.kyc'), sortValue: (row) => KYC_ORDER.indexOf(row.kycStatus), filter: 'choice', choices: choicesIn('kyc', choices),
      filterValue: (row) => t(`console.members.kycStatuses.${row.kycStatus}`),
      cell: (row) => <DotStatus tone={KYC_TONE[row.kycStatus]} label={t(`console.members.kycStatuses.${row.kycStatus}`)} />,
      exportValue: (row) => t(`console.members.kycStatuses.${row.kycStatus}`),
    },
    {
      key: 'played', share: 0.95, header: t('console.members.played'), align: 'end', sortValue: (row) => row.minutesPlayed * 60, exportValue: (row) => row.minutesPlayed,
      filter: 'duration',
      cell: (row) => formatDuration(row.minutesPlayed * 60),
    },
    { key: 'city', share: 0.8, header: t('console.members.city'), priority: 'optional', cell: (row) => row.city ?? t('console.members.notHere'), exportValue: (row) => row.city ?? '', sortValue: (row) => row.city ?? '', filter: 'choice', choices: choicesIn('city', choices) },
    {
      key: 'since', share: 1, header: t('console.members.memberSince'), priority: 'optional', sortValue: (row) => row.memberSince, filter: 'date',
      // The full date, in the list and its export: `12 Nov 2026` (the owner, 17 Nov; it was the month and year).
      cell: (row) => formatDate(new Date(row.memberSince)),
    },
  ];
}

/** How the list is drawn: whether the viewer sees full numbers, and what the server counted for each column's menu. */
export interface MemberColumnsFor {
  readonly seesPhone: boolean;
  /** Each choice column's values with the server's counts (redesign correction 4); undefined until they are read. */
  readonly choices: MemberChoices | undefined;
  /** Members on a break, frozen or erased, anyone else active; undefined until that is known. */
  readonly statuses: ReadonlyMap<string, MemberAccountStatus> | undefined;
  /** For floor and up (members.phone), as the Door's History: opens the member's changes by staff; without it, no History column. */
  readonly onHistory?: ((row: MemberListRow) => void) | undefined;
}

/** History at the row's end (the owner, 19 Nov): its icon alone, named for the member, opening their changes by staff at the side. */
function historyColumn(onHistory: (row: MemberListRow) => void): DataTableColumn<MemberListRow> {
  return {
    key: 'history', share: 0.45, header: '', align: 'end', filter: false, isExported: false,
    cell: (row) => (
      <Button variant="text" size="small" icon="history" aria-label={t('console.members.staffHistory.historyOf', { name: row.fullName })} onClick={() => onHistory(row)}>
        {null}
      </Button>
    ),
  };
}

/**
 * Members' columns (console v3; owner, 8 Nov): Name, No., Tier, the mobile for super admins, Status (F-121), ID check, Hours, City,
 * Joined, Tonight, Visits and Bonus (redesign RD-29); the name opens the record. With a record open beside the list, every
 * one of them, the lines scrolling sideways (owner, 9 Nov). The list is one page from the server, so each column says its
 * kind of filter, and what it sorts by here only names the order the server gives.
 */
export function memberColumns(tonight: ReadonlyMap<string, Tonight>, view: MemberColumnsFor): readonly DataTableColumn<MemberListRow>[] {
  const [name, number, tier, ...rest] = coreColumns(tonight, view.choices);
  const more = [...(view.seesPhone ? [mobileColumn] : []), accountColumn(view.statuses, view.choices), ...moreColumns(view.choices)];
  const history = view.onHistory === undefined ? [] : [historyColumn(view.onHistory)];
  return [name, number, tier, ...more, ...rest, ...history].filter((column) => column !== undefined);
}

/** Name, No., Tier, Tonight and Visits, as console v3 drew the list, then each member's Bonus in force (redesign RD-29). */
function coreColumns(tonight: ReadonlyMap<string, Tonight>, choices: MemberChoices | undefined): readonly DataTableColumn<MemberListRow>[] {
  return [
    // Twice a share, so a name stays on one line beside the record (the screenshot index: "Kabir / Sethi").
    { key: 'name', share: 2.1, header: t('console.members.name'), cell: (row) => row.fullName, sortValue: (row) => row.fullName, isWide: true, filter: 'text' },
    { key: 'number', share: 0.7, header: t('console.members.number'), cell: (row) => <Text variant="secondary" tone="muted">{String(row.memberNumber)}</Text>, sortValue: (row) => row.memberNumber, filter: 'number' },
    { key: 'tier', share: 1.1, header: t('console.members.tier'), cell: (row) => row.tierName, sortValue: (row) => row.tierName, filter: false },
    {
      key: 'tonight', share: 1.2, header: t('console.members.tonight'), cell: (row) => <TonightStatus tonight={tonight.get(row.memberId)} />,
      sortValue: (row) => tonightOrder(tonight.get(row.memberId)), exportValue: (row) => tonightWords(tonight.get(row.memberId)), filter: 'choice', choices: choicesIn('tonight', choices),
      filterValue: (row) => tonightKind(tonight.get(row.memberId)),
    },
    { key: 'visits', share: 0.95, header: t('console.members.visits'), cell: (row) => formatNumber(row.visits), sortValue: (row) => row.visits, align: 'end', filter: 'number' },
    {
      key: 'bonus', share: 0.95, header: t('console.members.bonus.column'), cell: (row) => formatChips(row.bonus), sortValue: (row) => Number(formatRupeesForFile(row.bonus)),
      exportValue: (row) => Number(formatRupeesForFile(row.bonus)), align: 'end', filter: 'number',
    },
  ];
}

/** Tonight as its filter reads it (owner, 8 Nov): Seated, Waiting, In the room, Left or Not here, never a seat of its own. */
function tonightKind(tonight: Tonight | undefined): string {
  if (tonight === undefined) return t('console.members.tonightKinds.notHere');
  if (tonight.kind === 'seated') return t('console.members.tonightKinds.seated');
  return tonight.kind === 'in_room' ? t('console.members.inRoom') : t(`console.members.${tonight.kind}`);
}

/** Tonight in words for an export: `Table 2, seat 3`, `Waiting`, `In the room` or `Left`. */
function tonightWords(tonight: Tonight | undefined): string {
  if (tonight === undefined) return '';
  if (tonight.kind === 'seated') return t('console.members.seatFull', { table: tonight.tableName, seat: tonight.seat });
  if (tonight.kind === 'in_room') return t('console.members.inRoom');
  return t(tonight.kind === 'waiting' ? 'console.members.waiting' : 'console.members.left');
}
