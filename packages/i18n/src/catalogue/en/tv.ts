/** Copy on the TV screens and the slides @rivr/render draws for them. */
export const tv = {
  /** The five boards (redesign RD-28), as the console names them: on the TV, call time is titled Seats opening (owner, 15 Nov). */
  modes: {
    waitlist: 'Waitlist board',
    call_time: 'Call-time board',
    promotions: 'Promotions',
    leaderboard: 'Hours leaderboard',
    high_hand: 'High hand bonus',
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
    /** More tables than the board holds take turns: under the columns. */
    page: 'Page {page} of {pages}',
    /** Under a player called to a seat: `{table}` is the table's name. */
    called: 'Called to {table}',
    away: 'Away',
  },
  /** The hours leaderboard (decision 0581): members by the hours they played tonight, and in the period the club set. */
  leaderboard: {
    title: 'Most hours played',
    empty: 'No hours played yet.',
    /** Over each list, in capitals. */
    periods: { tonight: 'Tonight', week: 'This week', month: 'This month', all: 'All time' },
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
  /** The call-time board (decision 0163), titled Seats opening on the TV (owner, 15 Nov): every seat on call time in one list, soonest first. */
  callTime: {
    title: 'Seats opening',
    empty: 'No one on call time.',
    /** Where a seat is: `{table} · seat {seat}`. */
    where: '{table} · seat {seat}',
    /** At the right of a player marked leaving whose call time is done: the seat opens now. */
    opensNow: 'Now',
    /** At the right of a player away from the table, whose clock stands still. */
    away: 'Away',
  },
  /** The High hand bonus board (redesign RD-25), until its own words come with the board. */
  highHand: {
    title: 'High hand bonus',
    empty: 'No high hand bonus running.',
  },
  /** A promotion slide in the TV's rotation (#64). */
  promotion: {
    /** The board's title, in the stage's header. */
    title: 'Promotions',
    /** In gold capitals over a promotion's title. */
    label: 'Offer',
    /** The pager, for a screen reader: "Promotion 2 of 3". */
    pager: 'Promotion {current} of {count}',
    /** The Promotions mode with nothing live. */
    none: 'No promotions running.',
  },
} as const;
