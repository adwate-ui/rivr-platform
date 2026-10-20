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
  /** The jackpot with tonight's high hand (#65). */
  jackpot: {
    highHandTonight: 'High hand tonight',
    noHighHand: 'No high hand yet tonight.',
    /** A four of a kind with its rank: "Four of a kind, Queens". */
    handWithRank: '{hand}, {rank}',
    /** Under the hand: the table, when (IST) and what it paid. */
    highHandLine: '{table} · {time} · {amount}',
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
