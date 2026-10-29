/** The player's session history (#127, #549, #627): each club month's sessions, and a session's detail, with no money. */
export const playerSessions = {
  title: 'Sessions',
  empty: 'No sessions yet.',
  /** A tournament in the history, under its name (#549): `Tournament · place 4 of 61 · 6 h`. */
  sub: '{what} · {hours}',
  tournament: 'Tournament',
  tournamentPlace: 'Tournament · place {place} of {entrants}',
  /** A session at several tables, named by the one played longest: `Table 2 and 1 more`. */
  moreTables: '{table} and {count} more',
  /** A club month's totals above its sessions: `3 sessions · 12 h 40 min`. */
  monthSummary: '{count} sessions · {hours}',
  monthSummaryOne: '1 session · {hours}',
  /** A session's detail (#627): when and how long, and the way to hide it from the member's own list. */
  time: 'Time',
  timeRange: '{from} to {to}',
  hours: 'Hours',
  hide: 'Hide from my sessions',
  hideNote: 'Only your list leaves it out. The club keeps its record.',
  hideFailed: 'That did not go through. Check the connection and try again.',
  notFound: 'This session is not in your history.',
} as const;
