/** The player's session history (#127, #549, #627): each club month's sessions, and a session's detail, with no money. */
export const playerSessions = {
  title: 'Sessions',
  /** The list's next page (F3-28). */
  showEarlier: 'Show earlier sessions',
  empty: 'No sessions yet. Each night you play at the club shows here.',
  /** A tournament in the history, under its name (#549): `Tournament · place 4 of 61 · 6 h`. */
  sub: '{what} · {hours}',
  tournament: 'Tournament',
  /** A tournament's Game in its detail, and the first part of its line in the list. */
  tournamentPlace: 'Tournament · place {place} of {entrants}',
  /** A session at several tables, named by the one played longest: `Table 2 and 1 more`. */
  moreTables: '{table} and {count} more',
  /** A session's detail (#627): when and how long, and the way to hide it from the member's own list. */
  time: 'Time',
  timeRange: '{from} to {to}',
  hide: 'Hide from my list',
  hiddenToast: 'Hidden from your list',
  /** The redesign's stats and detail rows (decision 0320). */
  thisMonth: 'This month',
  hoursPlayed: 'Hours played',
  game: 'Game',
  played: 'Played',
  hideFailed: 'Not sent. Try again.',
  notFound: 'This session is not in your history.',
} as const;
