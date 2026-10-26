/** Copy on the TV screens and the slides @rivr/render draws for them. */
export const tv = {
  badBeatJackpot: {
    /** Letter-spaced label above the jackpot figure. */
    title: 'Bad-beat jackpot',
  },
  /** The display modes (additions "TV modes"), as the console offers them and a TV names its own (#49). */
  modes: {
    waitlist: 'Waitlist board',
    call_time: 'Call-time board',
    jackpot: 'Jackpot and high hand',
    tournament_clock: 'Tournament clock',
    promotions: 'Promotions',
    rewards: 'Rewards ticker',
    league: 'League leaderboard',
    social_wall: 'Social wall',
    spin_wheel: 'Spin wheel',
  },
  /** The waitlist board (#65). */
  waitlist: {
    title: 'Waitlist',
    empty: 'No one waiting.',
    noTablesOpen: 'No tables open',
    oneTableOpen: '1 table open',
    tablesOpen: '{count} tables open',
    /** Beside a player called to a seat: `{table}` is the table's name. */
    called: 'Called to {table}',
    away: 'Away',
    /** A member who hid their name on the TVs (#326): `{place}` is their place on the list. */
    hiddenName: 'Player {place}',
  },
  /** The call-time board (decision 0163): the seats about to open, and every table's players on call time. */
  callTime: {
    title: 'Call time',
    openingsTitle: 'Seats opening',
    noOpenings: 'No seats opening yet.',
    empty: 'No one on call time.',
    /** Where a seat opens: `{table} · Seat {seat}`. */
    where: '{table} · Seat {seat}',
    /** When it opens: `{time}` is 25 min, or 1 h 5 min. */
    opensIn: 'In {time}',
    opensNow: 'Now',
    /** A player away from the table: their clock stands still. */
    paused: '{time}, away',
    /** A member who hid their name on the TVs (#326). */
    hiddenName: 'Seat {seat}',
    /** Under a list cut short. */
    more: '+{count} more',
    /** More tables than fit take turns: `Tables 1 to 4 of 6`. */
    page: 'Tables {from} to {to} of {count}',
  },
  /** The jackpot with tonight's high hand (#65). */
  jackpot: {
    highHandTonight: 'High hand tonight',
    noHighHand: 'No high hand yet tonight.',
    /** A four of a kind with its rank: "Four of a kind, Queens". */
    handWithRank: '{hand}, {rank}',
    /** Under the hand: the table, when (IST) and what it paid. */
    highHandLine: '{table} · {time} · {amount}',
  },
  /** The tournament clock (#64). Blinds, antes and stacks are chips, written with formatNumber. */
  tournamentClock: {
    level: 'Level {level}',
    ante: 'Ante {ante}',
    next: 'Next {blinds}',
    nextWithAnte: 'Next {blinds} ante {ante}',
    paused: 'Paused',
    players: 'Players',
    entries: 'Entries',
    average: 'Average',
    pool: 'Pool',
    payouts: 'Payouts',
    noPayouts: 'Payouts are set when registration closes.',
  },
  /** A promotion slide in the TV's rotation (#64). */
  promotion: {
    label: 'Promotion',
    /** The pager, for a screen reader: "Promotion 2 of 3". */
    pager: 'Promotion {current} of {count}',
    /** The Promotions mode with nothing live. */
    none: 'No promotions running.',
  },
  /** The high hands the club pays (#47), on the TV, the tablet and the console. */
  highHand: {
    four_of_a_kind: 'Four of a kind',
    straight_flush: 'Straight flush',
    royal_flush: 'Royal flush',
  },
  /** The rank of a four of a kind, as the tablet keeps it. */
  ranks: {
    A: 'Aces', K: 'Kings', Q: 'Queens', J: 'Jacks', T: 'Tens', '9': 'Nines', '8': 'Eights',
    '7': 'Sevens', '6': 'Sixes', '5': 'Fives', '4': 'Fours', '3': 'Threes', '2': 'Twos',
  },
} as const;
