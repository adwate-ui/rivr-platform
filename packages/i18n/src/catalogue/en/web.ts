/** The public website's own copy; its pages' words are the club's site content. */
export const webApp = {
  /** A website page when its content cannot be read. */
  unavailableTitle: 'The website is not available',
  unavailable: 'Try again in a few minutes.',
  /** The header's one action (#441): a WhatsApp message to the club, with these words ready to send (#616). */
  reserve: 'Reserve a seat',
  reserveMessage: 'Hi RIVR, I would like to reserve a seat tonight.',
  /** The header's menu, in grandpokerarena.com's order (#616). */
  menu: {
    club: 'The Club',
    room: 'The Room',
    games: 'Games',
    membership: 'Membership',
    leaderboard: 'Leaderboard',
    whatsOn: "What's On",
    prizes: 'Prizes & Calendar',
    journal: 'Journal',
    visit: 'Visit & Contact',
  },
  /** The bar above the header (#616): how to reach the club, and the member app. */
  top: {
    phone: '+91 00000 00000',
    whatsapp: 'WhatsApp',
    instagram: 'Instagram',
    youtube: 'YouTube',
    email: 'info@rivrpoker.com',
    app: 'Member app',
  },
  /** A promotions block while none runs (decision 0166). */
  noPromotions: 'No promotions are running just now. Check back soon.',
  /** A post on the website's social wall (#157). */
  wallHandle: '@{handle}',
  wallOpen: 'See it on Instagram',
  /** The Leaderboard (#617): the RIVR League's standings, names as the TVs show them, and the prizes from league.prizes. */
  league: {
    place: 'Place',
    member: 'Member',
    points: 'Points',
    /** A member who hid their name on the TVs. */
    hidden: 'A member',
    monthIntro: 'The standings for {month}, from cash games and tournaments.',
    none: 'No standings yet. They start with the first night of play.',
    prizes: 'Prizes: {prizes}',
  },
  /** What play earns (#617), read from the club's rules in force. */
  rewards: {
    intro: 'Every hour at the table earns points, more at the higher stakes.',
    table: 'Table',
    points: 'Points an hour',
    rakeback: 'Rakeback',
    rakebackRate: '{percent}% of your rake',
    none: 'None',
    rounding: 'Only time seated at the table counts, rounded down to a whole point. Points are for rewards and never turn into cash.',
    rakebackPaid: 'Rakeback is paid as bonus each Monday.',
    rakeShare: 'RIVR Rewards: {percent}% of your rake comes back as points.',
  },
  /** The cab and hotel nights the club gives (#617), read from the club's rules in force. */
  outstation: {
    cab: 'Pick-up and drop',
    cabText: 'A cab to the club and home again, once you have played {visits} times this month.',
    hotel: 'Hotel nights',
    hotelAt: '{table}: a night for every {hours} hours played',
  },
  /** The Bad Beat Jackpot and rare-hand bonuses (#618), read from the live pool and the club's rules in force. */
  jackpot: {
    badBeat: 'Bad Beat Jackpot',
    pool: '{amount} in the pool',
    share: 'A bad beat pays {percent}% of the pool, shared at the table:',
    loser: 'The player whose hand loses: {percent}%',
    winner: 'The player who wins the hand: {percent}%',
    table: 'Everyone else dealt in: {percent}%',
    rareHands: 'Rare hand bonuses',
    pays: '{hand}: {amount}',
    royalFlush: 'Royal flush',
    straightFlush: 'Straight flush',
    fourOfAKind: 'Four of a kind',
  },
  /** The footer on every page (#441): where the club is, its columns of links (#616), its 18+ line and copyright. */
  footer: {
    address: 'Upper floor, Glaza, M3M 65th Avenue, Gurugram',
    notice: 'Strictly 18+. Poker is a game of skill.',
    copyright: 'Copyright 2026 RIVR Poker Club',
    cookieSettings: 'Cookie settings',
    club: 'The club',
    story: 'Our story',
    room: 'The room',
    membership: 'Membership',
    standard: 'The standard',
    play: 'Play',
    games: 'Games',
    leaderboard: 'Leaderboard',
    tournaments: 'Tournaments',
    promotions: 'Promotions',
    app: 'Member app',
    policies: 'Policies',
    /** The club's policy pages, linked from every page's footer (decision 0166). */
    houseRules: 'House rules',
    legal: 'Legal standing',
    questions: 'Questions',
    responsiblePlay: 'Responsible play',
    privacy: 'Privacy',
    terms: 'Terms of use',
    /** Free, confidential helplines for anyone whose play worries them, as grandpokerarena.com lists them. */
    helplines: 'Need to talk?',
    teleManas: 'Tele-MANAS 14416 (24 hours)',
    iCall: 'iCall 91529 87821',
  },
} as const;
