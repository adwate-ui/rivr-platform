/** The player's session history (#127, #549, #627): each club month's sessions, and a session's detail, with no money. */
export const playerSessions = {
  title: 'Sessions',
  /** The list's next page (F3-28). */
  showEarlier: 'Show earlier sessions',
  empty: 'No sessions yet. Each night you play at the club shows here.',
  /** A past tournament the member asked to be notified of, under its name, with the entries once the club has typed them (redesign RD-26). */
  tournament: 'Tournament',
  tournamentEntries: 'Tournament · {entries} entries',
  tournamentOneEntry: 'Tournament · 1 entry',
  /** A tournament's Time in its detail: when it started. */
  started: 'Started',
  /** A session at several tables, named by the one played longest: `Table 2 and 1 more`. */
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
