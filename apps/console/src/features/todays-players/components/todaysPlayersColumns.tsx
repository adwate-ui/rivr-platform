import type { TodayStatus, TodaysPlayer } from '@rivr/db';
import { formatDuration, formatTime, t } from '@rivr/i18n';
import { DotStatus, type DataTableColumn, type DotStatusTone } from '@rivr/ui';

// Who needs the floor first: those waiting, then those playing, then those who left.
const RANK: Readonly<Record<TodayStatus, number>> = { waiting: 0, playing: 1, left: 2 };

// Gold for a player waiting for a seat (decision 0463); cream for one playing; faint for one gone.
const TONE: Readonly<Record<TodayStatus, DotStatusTone>> = { waiting: 'needsYou', playing: 'active', left: 'inactive' };

const NONE = () => t('console.todaysPlayers.none');
const at = (iso: string | null) => (iso === null ? NONE() : formatTime(new Date(iso)));

/** Every second a player has played today, across their tables. */
const playedSeconds = (player: TodaysPlayer) => player.tables.reduce((total, entry) => total + entry.seconds, 0);

/** The tables a player played on today, in the order they sat at them. */
const tablesOf = (player: TodaysPlayer) => (player.tables.length === 0 ? NONE() : player.tables.map((entry) => entry.table).join(', '));

/**
 * Today's players' columns (console v3): the tables and the time played each in a column of their own. The words and the
 * longer figures take two shares, so a phone's scrolling line (640 px at least) keeps each on one line.
 */
export const TODAYS_PLAYERS_COLUMNS: readonly DataTableColumn<TodaysPlayer>[] = [
  { key: 'name', header: t('console.todaysPlayers.name'), cell: (player) => player.fullName, sortValue: (player) => player.fullName, priority: 'primary', isWide: true },
  {
    key: 'status', header: t('console.todaysPlayers.status'), sortValue: (player) => RANK[player.status], isWide: true,
    cell: (player) => <DotStatus tone={TONE[player.status]} label={t(`console.todaysPlayers.statuses.${player.status}`)} />,
    exportValue: (player) => t(`console.todaysPlayers.statuses.${player.status}`),
  },
  { key: 'in', header: t('console.todaysPlayers.checkedIn'), cell: (player) => at(player.checkedInAt), sortValue: (player) => player.checkedInAt ?? '' },
  { key: 'out', header: t('console.todaysPlayers.checkedOut'), cell: (player) => at(player.checkedOutAt), sortValue: (player) => player.checkedOutAt ?? '' },
  { key: 'waited', header: t('console.todaysPlayers.waited'), cell: (player) => formatDuration(player.waitingSeconds), sortValue: (player) => player.waitingSeconds, align: 'end' },
  { key: 'table', header: t('console.todaysPlayers.table'), cell: tablesOf, sortValue: tablesOf, isWide: true },
  {
    key: 'played', header: t('console.todaysPlayers.played'), sortValue: playedSeconds, align: 'end', isWide: true,
    cell: (player) => (player.tables.length === 0 ? NONE() : formatDuration(playedSeconds(player))),
  },
];

/**
 * The columns on a phone, below 768 px: without In and Out, so the scrolling line (640 px at least) holds the rest each
 * on one line; In and Out show from 768 px.
 */
export const TODAYS_PLAYERS_PHONE_COLUMNS = TODAYS_PLAYERS_COLUMNS.filter((column) => column.key !== 'in' && column.key !== 'out');
