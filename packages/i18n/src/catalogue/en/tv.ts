/** Copy on the TV screens and the slides @rivr/render draws for them. */
export const tv = {
  /** The display modes (additions "TV modes"), as the console offers them and a TV names its own (#49). */
  modes: {
    waitlist: 'Waitlist board',
    call_time: 'Call-time board',
    jackpot: 'Jackpot and high hand',
    tournament_clock: 'Tournament clock',
    promotions: 'Promotions',
    social_wall: 'Social wall',
    leaderboard: 'Hours leaderboard',
  },
  /** Under a list on a board cut short (F-044). */
  more: '+{count} more',
  /** A member who hid their name on the TVs (#326), on a row with no seat or place to go by: a redemption. Beside a number, the name is left blank (F-137). */
  hiddenName: 'A member',
  /** The waitlist board (#65), a list a table (decision 0467). */
  waitlist: {
    title: 'Waitlist',
    empty: 'No one waiting.',
    /** Under a closed table somebody waits for (decision 0467): `{stake}` as `NLH 100/200`. */
    closed: '{stake} · Closed',
    /** More tables than fit take turns (F-140). */
    page: 'Page {page} of {pages}',
    /** The open tables with no list, on one line at the foot (F-140): `Table 4, Table 5: no list`. */
    noList: '{tables}: no list',
    footer: '{page} · {folded}',
    /** Beside a player called to a seat: `{table}` is the table's name. */
    called: 'Called to {table}',
    away: 'Away',
  },
  /** The hours leaderboard (decision 0581): members by the hours they played in the period the club set. */
  leaderboard: {
    title: 'Most hours played',
    empty: 'No hours played yet.',
    periods: { tonight: 'Tonight', week: 'This week', month: 'This month', all: 'All time' },
    /** Over a column: `Places 1 to 6`. */
    places: 'Places {from} to {to}',
    /** Over a column whose rows all share a place. */
    place: 'Place {place}',
    /** A member who hid their name on the TVs, by their member number (the owner, 12 Nov). */
    member: 'Member #{number}',
  },
  /** The High hand bonus board's body (redesign RD-25): the hands, and tonight's payouts. `{hand}` is the hit named exactly. */
  highHand: {
    hands: 'Hit one, get paid',
    paidTonight: 'Paid tonight',
    noneYet: 'None yet tonight.',
    /** Under a player's name: `Four Jacks · Table 2 · 02:43`. */
    payout: '{hand} · {table} · {time}',
  },
  /** The call-time board (decision 0163): the seats about to open, and every table's players on call time. */
  callTime: {
    title: 'Call time',
    openingsTitle: 'Seats opening',
    noOpenings: 'No seats opening yet.',
    empty: 'No one on call time.',
    /** Where a seat opens: `{table} · Seat {seat}`. */
    where: '{table} · Seat {seat}',
    /** When it opens: `{time}` is 0h 25m, or 1h 05m. */
    opensIn: 'In {time}',
    opensNow: 'Now',
    /** A player away from the table, whose clock stands still: one word, so a name beside it is not cut (F-138). */
    away: 'Away',
    /** More tables than fit take turns: `Tables 1 to 4 of 6`. */
    page: 'Tables {from} to {to} of {count}',
  },
  /** A promotion slide in the TV's rotation (#64). */
  promotion: {
    label: 'Promotion',
    /** The pager, for a screen reader: "Promotion 2 of 3". */
    pager: 'Promotion {current} of {count}',
    /** The Promotions mode with nothing live. */
    none: 'No promotions running.',
  },
} as const;
