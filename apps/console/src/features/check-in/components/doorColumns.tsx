import type { Paise } from '@rivr/domain/money';
import type { DoorPlayer, DoorStatus, ListChoices, ListFilter, MemberKycStatus } from '@rivr/db';
import { formatChips, formatDuration, formatMobile, formatRupeesForFile, formatTime, t } from '@rivr/i18n';
import { Button, DotStatus, Inline, MemberLink, Text, type ColumnChoice, type DataTableColumn, type DotStatusTone } from '@rivr/ui';
import type { ReactNode } from 'react';

// Who needs the door first: those waiting for a seat and those expected, then those playing, then those gone.
const RANK: Readonly<Record<DoorStatus, number>> = { waiting: 0, expected: 1, playing: 2, in_room: 3, left: 4, never_arrived: 5 };

// Gold for a player waiting for a seat or expected at the door (decision 0463); cream for one playing; faint for one gone.
const TONE: Readonly<Record<DoorStatus, DotStatusTone>> = {
  waiting: 'needsYou', expected: 'needsYou', playing: 'active', in_room: 'active', left: 'inactive', never_arrived: 'inactive',
};
const KYC_TONE: Readonly<Record<MemberKycStatus, DotStatusTone>> = {
  verified: 'active', in_review: 'needsYou', at_desk: 'needsYou', refused: 'danger', not_done: 'inactive',
};

const NONE = () => t('console.todaysPlayers.none');
const at = (iso: string | null) => (iso === null ? NONE() : formatTime(new Date(iso)));
// A wait counts only after check-in (the owner, 19 Nov): one never checked in has none, which is no 0 min.
const waited = (seconds: number | null) => (seconds === null ? NONE() : formatDuration(seconds));

/** A seat's time at its table: 17:53–18:43, or 17:53– while they are there; none with no seat (the owner, 19 Nov). */
function atTable({ seatedAt, leftAt }: { readonly seatedAt: string | null; readonly leftAt: string | null }): string {
  if (seatedAt === null) return NONE();
  const from = formatTime(new Date(seatedAt));
  return leftAt === null ? t('console.todaysPlayers.atTableOpen', { from }) : t('console.todaysPlayers.atTableSpan', { from, to: formatTime(new Date(leftAt)) });
}
// The tier only above the base one: at the door a number tells members apart, and a tier is worth saying when it is one (audit F-020).
/** Bonus in rupees for sorting and exports; none is left blank in a file and sorts below nothing. */
const rupees = (paise: Paise | null) => (paise === null ? -1 : Number(formatRupeesForFile(paise)));
const rupeesInFile = (paise: Paise | null) => (paise === null ? '' : Number(formatRupeesForFile(paise)));
const chips = (paise: Paise | null) => (paise === null ? NONE() : formatChips(paise));
const tierOf = (player: DoorPlayer) => (player.isBaseTier ? NONE() : player.tierName);
const tablesOf = (player: DoorPlayer) => (player.tables.length === 0 ? NONE() : player.tables.map((entry) => entry.table).join(', '));
const statusWords = (status: DoorStatus) => t(`console.todaysPlayers.statuses.${status}`);
const kycWords = (status: MemberKycStatus) => t(`console.members.kycStatuses.${status}`);

const STATUSES: readonly DoorStatus[] = ['playing', 'waiting', 'in_room', 'expected', 'left', 'never_arrived'];
const KYC: readonly MemberKycStatus[] = ['verified', 'in_review', 'at_desk', 'refused', 'not_done'];

/** The server's codes of Status and ID check, each with the words the table shows; a tier and a table are their own words. */
function wordsFor(column: string): readonly (readonly [code: string, words: string])[] | null {
  if (column === 'status') return STATUSES.map((status) => [status, statusWords(status)]);
  return column === 'kyc' ? KYC.map((status) => [status, kycWords(status)]) : null;
}

/** What a column's menu offers: its values in the table's words, each with the server's count over everyone the other filters leave. */
function choicesIn(column: string, counted: ListChoices | undefined): readonly ColumnChoice[] {
  const words = wordsFor(column);
  return (counted?.[column] ?? []).map(({ value, count }) => ({ value: words?.find(([code]) => code === value)?.[1] ?? value, count }));
}

/** A view's filters as the server reads them: a status or an ID check chosen by its words goes as the server's code. */
export function doorFiltersInCodes(filters: Readonly<Record<string, ListFilter>>): Readonly<Record<string, ListFilter>> {
  return Object.fromEntries(Object.entries(filters).map(([column, filter]): [string, ListFilter] => {
    const words = wordsFor(column);
    if (words === null || filter.kind !== 'choice') return [column, filter];
    return [column, { kind: 'choice', chosen: filter.chosen.map((label) => words.find(([, word]) => word === label)?.[0] ?? label) }];
  }));
}

// Floor and up see the mobile and History too (#1073): the name gives up width, so each mobile, heading and button stays on
// one line at 1440 px (the UI review of the pull request; measured again with a row a seat, the owner, 19 Nov).
const WITH_CONTACT: Partial<Record<string, number>> = { player: 1.1 };

const sharesWithContact = (columns: readonly DataTableColumn<DoorPlayer>[], kept: string) => columns.map((column) => {
  const share = column.key === kept ? undefined : WITH_CONTACT[column.key];
  return share === undefined ? column : { ...column, share };
});

/**
 * The member's mobile and History (#1073), for floor and up: the server gives the number only to them, History opens in
 * the panel at the side, and the mobile is never in an export (decision 0690). On Today's players each has a column: the
 * mobile after the number, History at the end. On Check-in the row's button leaves no room for two more columns at
 * 1440 px, so the mobile goes under the name and History beside the button.
 */
function withContact(
  columns: readonly DataTableColumn<DoorPlayer>[], onHistory: (player: DoorPlayer) => void, action: ((player: DoorPlayer) => ReactNode) | undefined,
): DataTableColumn<DoorPlayer>[] {
  const history = (player: DoorPlayer) => (
    <Button variant="text" size="small" aria-label={t('console.todaysPlayers.historyOf', { name: player.fullName })} onClick={() => onHistory(player)}>
      {t('console.todaysPlayers.history')}
    </Button>
  );
  if (action === undefined) {
    const mobile: DataTableColumn<DoorPlayer> = {
      key: 'phone', share: 1.84, header: t('console.members.mobile'), filter: false, isExported: false,
      cell: (player) => (player.phone === null ? NONE() : <Text variant="secondary" tone="muted">{formatMobile(player.phone)}</Text>),
    };
    const shown = sharesWithContact(columns, '');
    return [...shown.slice(0, 2), mobile, ...shown.slice(2), { key: 'history', share: 1.13, header: '', align: 'end', filter: false, cell: history }];
  }
  // The name, over its mobile, gives up a little more, so History and Check out stay on one line. Status has no sort arrow
  // here, as Today's players opens sorted by it, so it gives up the arrow's room.
  const named = sharesWithContact(columns, 'player').map((column) => {
    if (column.key === 'status') return { ...column, share: 1.1 };
    return column.key !== 'player' ? column : {
      ...column, share: 1.83, exportValue: (player: DoorPlayer) => player.fullName,
      cell: (player: DoorPlayer) => <><MemberLink memberId={player.memberId}>{player.fullName}</MemberLink>{player.phone === null ? null : <Text variant="secondary" tone="muted">{formatMobile(player.phone)}</Text>}</>,
    };
  });
  // Below 768 px the column is one 128 px track (DataTable's sideways layout), too narrow for both on one line: Check out
  // wraps under History rather than squeeze its words onto two lines.
  return [...named, { key: 'action', share: 2.72, header: '', align: 'end', isWide: true, filter: false, cell: (player) => <Inline gap={2} justify="end" wrap>{history(player)}{action(player)}</Inline> }];
}

/**
 * The door's columns (redesign RD-30, as its prototype has them): the player, their number and tier, where they stand,
 * when they came in and went out, how long they waited, their tables, the time played and their ID check; then, where
 * the screen acts on a row, its button. Each column says its share of the width, so every heading fits beside its menu at
 * 1440 px (the UI review of the pull request). The server sorts and filters, so each column says its kind of filter and the
 * menus hold the server's counts.
 */
export function doorColumns(
  counted: ListChoices | undefined, action?: (player: DoorPlayer) => ReactNode, onHistory?: (player: DoorPlayer) => void,
): readonly DataTableColumn<DoorPlayer>[] {
  const columns: DataTableColumn<DoorPlayer>[] = [
    { key: 'player', share: 2, header: t('console.todaysPlayers.name'), cell: (player) => <MemberLink memberId={player.memberId}>{player.fullName}</MemberLink>, sortValue: (player) => player.fullName, priority: 'primary', isWide: true, filter: 'text' },
    { key: 'number', share: 0.58, header: t('console.members.number'), cell: (player) => <Text variant="secondary" tone="muted">{String(player.memberNumber)}</Text>, sortValue: (player) => player.memberNumber, exportValue: (player) => player.memberNumber, filter: 'number' },
    { key: 'tier', share: 0.78, header: t('console.members.tier'), cell: tierOf, exportValue: (player) => player.tierName, sortValue: (player) => player.tierName, filter: 'choice', choices: choicesIn('tier', counted), filterValue: (player) => player.tierName },
    {
      key: 'status', share: 1.42, header: t('console.todaysPlayers.status'), sortValue: (player) => RANK[player.status], isWide: true, filter: 'choice', choices: choicesIn('status', counted),
      filterValue: (player) => statusWords(player.status),
      cell: (player) => <DotStatus tone={TONE[player.status]} label={statusWords(player.status)} />, exportValue: (player) => statusWords(player.status),
    },
    { key: 'in', share: 0.6, header: t('console.todaysPlayers.checkedIn'), cell: (player) => at(player.checkedInAt), sortValue: (player) => player.checkedInAt ?? '', filter: false },
    { key: 'out', share: 0.6, header: t('console.todaysPlayers.checkedOut'), cell: (player) => at(player.checkedOutAt), sortValue: (player) => player.checkedOutAt ?? '', filter: false },
    { key: 'waited', share: 0.86, filter: 'duration', header: t('console.todaysPlayers.waited'), cell: (player) => waited(player.waitingSeconds), sortValue: (player) => player.waitingSeconds ?? -1, align: 'end' },
    { key: 'table', share: 0.98, header: t('console.todaysPlayers.table'), cell: tablesOf, sortValue: tablesOf, filter: 'text' },
    // A row is a seat (the owner, 19 Nov): its time at the table, sorted by when they sat; exported as its words, since an
    // export has one value a column.
    { key: 'seated', share: 1.31, header: t('console.todaysPlayers.atTable'), cell: atTable, sortValue: (player) => player.seatedAt ?? '', exportValue: atTable, filter: false },
    {
      key: 'played', share: 1.03, filter: 'duration', header: t('console.todaysPlayers.played'), sortValue: (player) => player.playedSeconds, align: 'end',
      cell: (player) => (player.tables.length === 0 ? NONE() : formatDuration(player.playedSeconds)),
    },
    // The Bonus given to them today (#1062), on their first row alone, and the Bonus used at each seat (the owner, 19 Nov).
    {
      key: 'bonus', share: 0.8, header: t('console.todaysPlayers.bonus'), align: 'end', filter: false,
      sortValue: (player) => rupees(player.bonus), exportValue: (player) => rupeesInFile(player.bonus), cell: (player) => chips(player.bonus),
    },
    {
      key: 'bonus_used', share: 0.72, header: t('console.todaysPlayers.bonusUsed'), align: 'end', filter: false,
      sortValue: (player) => rupees(player.bonusUsed), exportValue: (player) => rupeesInFile(player.bonusUsed), cell: (player) => chips(player.bonusUsed),
    },
    {
      key: 'kyc', share: 1.26, header: t('console.members.kyc'), sortValue: (player) => KYC.indexOf(player.kycStatus), isWide: true, filter: 'choice', choices: choicesIn('kyc', counted),
      filterValue: (player) => kycWords(player.kycStatus),
      cell: (player) => <DotStatus tone={KYC_TONE[player.kycStatus]} label={kycWords(player.kycStatus)} />, exportValue: (player) => kycWords(player.kycStatus),
    },
  ];
  if (onHistory !== undefined) return withContact(columns, onHistory, action);
  // A column with no heading holds the row's button, and is left out of exports; two shares, so the button stays on one line.
  return action === undefined ? columns : [...columns, { key: 'action', share: 1.45, header: '', cell: action, align: 'end', isWide: true, filter: false }];
}
