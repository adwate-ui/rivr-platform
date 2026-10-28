/** The player's session history (#127, #93, #549, #563): each club month's sessions, and a session's detail. */
export const playerSessions = {
  title: 'Sessions',
  empty: 'No sessions yet.',
  /** TDS certificate data (#93), shown only when TDS was withheld: `Oct–Dec 2026 · RIVR Gaming Pvt Ltd · TAN DELR12345E`. */
  tds: 'TDS withheld',
  tdsFrom: '{quarter} · {legalName} · TAN {tan}',
  tdsAmount: '{tds} under section {section}, from {count} payments',
  noTan: 'not yet given',
  /** A session in the history (#127): `100/200 · 6 h 30 min`. */
  sub: '{stakes} · {hours}',
  /** A tournament in the history, in place of the stakes (#549): `Tournament · place 4 of 61`. */
  tournament: 'Tournament',
  tournamentPlace: 'Tournament · place {place} of {entrants}',
  prize: 'Prize',
  /** A session at several tables, named by the one played longest: `Table 2 and 1 more`. */
  moreTables: '{table} and {count} more',
  /** A club month's totals above its sessions: `3 sessions · 12 h 40 min`. */
  monthSummary: '{count} sessions · {hours}',
  monthSummaryOne: '1 session · {hours}',
  /** A session's detail (design prompt, "Sessions"): bonus chips, TDS and what was paid only when they apply. */
  stake: 'Stake',
  time: 'Time',
  timeRange: '{from} to {to}',
  hours: 'Hours',
  buyIn: 'Buy-in',
  bonus: 'Bonus chips',
  cashOut: 'Cash-out',
  tdsLine: 'TDS withheld',
  /** Under the TDS line when it was withheld on a period's winnings, not the session's alone (#563). */
  tdsOn: { day: 'TDS on the day’s winnings', financial_year: 'TDS on this year’s winnings' },
  paid: 'Paid to you',
  net: 'Net',
  receipt: 'Receipt {reference}',
  notFound: 'This session is not in your history.',
} as const;
