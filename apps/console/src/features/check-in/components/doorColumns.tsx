import type { DoorPlayer, DoorStatus, ListChoices, ListFilter, MemberKycStatus } from '@rivr/db';
import { formatChips, formatDuration, formatRupeesForFile, formatTime, t } from '@rivr/i18n';
import { DotStatus, Text, type ColumnChoice, type DataTableColumn, type DotStatusTone } from '@rivr/ui';
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
// The tier only above the base one: at the door a number tells members apart, and a tier is worth saying when it is one (audit F-020).
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

/**
 * The door's columns (redesign RD-30, as its prototype has them): the player, their number and tier, where they stand,
 * when they came in and went out, how long they waited, their tables, the time played and their ID check; then, where
 * the screen acts on a row, its button. Each column says its share of the width, so every heading fits beside its menu at
 * 1440 px (the UI review of the pull request). The server sorts and filters, so each column says its kind of filter and the
 * menus hold the server's counts.
 */
export function doorColumns(counted: ListChoices | undefined, action?: (player: DoorPlayer) => ReactNode): readonly DataTableColumn<DoorPlayer>[] {
  const columns: DataTableColumn<DoorPlayer>[] = [
    { key: 'player', share: 2, header: t('console.todaysPlayers.name'), cell: (player) => player.fullName, sortValue: (player) => player.fullName, priority: 'primary', isWide: true, filter: 'text' },
    { key: 'number', share: 0.65, header: t('console.members.number'), cell: (player) => <Text variant="secondary" tone="muted">{String(player.memberNumber)}</Text>, sortValue: (player) => player.memberNumber, exportValue: (player) => player.memberNumber, filter: 'number' },
    { key: 'tier', share: 1.05, header: t('console.members.tier'), cell: tierOf, exportValue: (player) => player.tierName, sortValue: (player) => player.tierName, filter: 'choice', choices: choicesIn('tier', counted), filterValue: (player) => player.tierName },
    {
      key: 'status', share: 1.55, header: t('console.todaysPlayers.status'), sortValue: (player) => RANK[player.status], isWide: true, filter: 'choice', choices: choicesIn('status', counted),
      filterValue: (player) => statusWords(player.status),
      cell: (player) => <DotStatus tone={TONE[player.status]} label={statusWords(player.status)} />, exportValue: (player) => statusWords(player.status),
    },
    { key: 'in', share: 0.65, header: t('console.todaysPlayers.checkedIn'), cell: (player) => at(player.checkedInAt), sortValue: (player) => player.checkedInAt ?? '', filter: false },
    { key: 'out', share: 0.65, header: t('console.todaysPlayers.checkedOut'), cell: (player) => at(player.checkedOutAt), sortValue: (player) => player.checkedOutAt ?? '', filter: false },
    { key: 'waited', share: 1, filter: 'duration', header: t('console.todaysPlayers.waited'), cell: (player) => formatDuration(player.waitingSeconds), sortValue: (player) => player.waitingSeconds, align: 'end' },
    { key: 'table', share: 0.95, header: t('console.todaysPlayers.table'), cell: tablesOf, sortValue: tablesOf, filter: 'text' },
    {
      key: 'played', share: 1.5, filter: 'duration', header: t('console.todaysPlayers.played'), sortValue: (player) => player.playedSeconds, align: 'end',
      cell: (player) => (player.tables.length === 0 ? NONE() : formatDuration(player.playedSeconds)),
    },
    // The Bonus given to them today (#1062).
    {
      key: 'bonus', share: 1, header: t('console.todaysPlayers.bonus'), align: 'end', filter: false,
      sortValue: (player) => Number(formatRupeesForFile(player.bonus)), exportValue: (player) => Number(formatRupeesForFile(player.bonus)),
      cell: (player) => formatChips(player.bonus),
    },
    {
      key: 'kyc', share: 1.3, header: t('console.members.kyc'), sortValue: (player) => KYC.indexOf(player.kycStatus), isWide: true, filter: 'choice', choices: choicesIn('kyc', counted),
      filterValue: (player) => kycWords(player.kycStatus),
      cell: (player) => <DotStatus tone={KYC_TONE[player.kycStatus]} label={kycWords(player.kycStatus)} />, exportValue: (player) => kycWords(player.kycStatus),
    },
  ];
  // A column with no heading holds the row's button, and is left out of exports; two shares, so the button stays on one line.
  return action === undefined ? columns : [...columns, { key: 'action', share: 1.45, header: '', cell: action, align: 'end', isWide: true, filter: false }];
}
