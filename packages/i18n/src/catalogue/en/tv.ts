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
    leaderboard: 'Hours leaderboard',
  },
  /** Under a list on a board cut short (F-044). */
  more: '+{count} more',
  /** A member who hid their name on the TVs (#326), on a row with no seat or place to go by: a redemption, a spin. Beside a number, the name is left blank (F-137). */
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
  /** The rewards ticker (#148, decision 0183): this month's points leaders, and the week's redemptions with their time. */
  rewards: {
    title: 'Rewards',
    leaders: 'Points leaders',
    leadersDetail: 'This month',
    redeemed: 'Recently redeemed',
    redeemedDetail: 'This week',
    empty: 'Nothing yet.',
    points: '{points} points',
  },
  /** The spin wheel (#150, decision 0266): the prizes and their odds, and tonight's spins as they happen. */
  spin: {
    title: 'Spin wheel',
    wheel: 'On the wheel',
    wheelDetail: 'Odds',
    spins: 'Tonight’s spins',
    spinsDetail: 'Newest first',
    empty: 'Nothing yet.',
    /** `3 in 10`. */
    odds: '{weight} in {odds}',
    /** A wheel of more prizes than fit, a page at a time: `Prizes 7 to 9 of 9`. */
    page: 'Prizes {from} to {to} of {count}',
    points: '{points} points',
    /** `{chips}`: a count of bonus chips, `500` (#628). */
    bonus: '{chips} bonus chips',
    nothing: 'Nothing',
  },
  /** The social wall (#158, decision 0267): the club's approved Instagram posts, one after another. */
  socialWall: {
    label: 'On Instagram',
    handle: '@{handle}',
    none: 'No posts on the wall yet.',
    /** `Post 2 of 6`. */
    pager: 'Post {current} of {count}',
  },
  /** The hours leaderboard (decision 0581): members by the hours they played in the period the club set. */
  leaderboard: {
    title: 'Most hours played',
    empty: 'No hours played yet.',
    periods: { tonight: 'Tonight', week: 'This week', month: 'This month', all: 'All time' },
    /** Over a column: `Places 1 to 6`. */
    places: 'Places {from} to {to}',
    /** A member who hid their name on the TVs, by their member number (the owner, 12 Nov). */
    member: 'Member #{number}',
  },
  /** The League leaderboard (#148, decision 0182): this month's places, and the season's. */
  league: {
    title: 'RIVR League',
    thisMonth: 'This month',
    /** A season's months: `November 2026 to April 2027`. */
    seasonMonths: '{first} to {last}',
    empty: 'No League points yet.',
    /** Beside a name at 48 px: the board says whose points they are. */
    points: '{points} points',
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
    /** On @rivr/render's slide only: the TV shows no prize pool (#628). */
    pool: 'Pool',
    payouts: 'Payouts',
    noPayouts: 'Payouts are set when registration closes.',
    /** On a break the clock shows this in place of the blinds (#119). */
    break: 'Break',
    breakLevel: 'Break after level {level}',
    /** With no tournament running at the venue. */
    none: 'No tournament is running.',
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
