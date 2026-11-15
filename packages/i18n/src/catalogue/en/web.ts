/** The public website's own copy; its pages' words are the club's site content. */
export const webApp = {
  /** A page's `<title>` and link preview (F-194): `Visit · RIVR Poker Club, Gurugram`. */
  pageTitle: '{page} · RIVR Poker Club, Gurugram',
  /** The same for a page named for the club. */
  clubTitle: 'RIVR Poker Club, Gurugram',
  /** A website page when its content cannot be read. */
  unavailableTitle: 'Website unavailable',
  unavailable: 'Try again shortly.',
  /** A missing page's way back (W-07). */
  backHome: 'Front page',
  /** The header's one action (#441): a WhatsApp message to the club, with these words ready to send (#616), in the app's verb. */
  reserve: 'Request a seat',
  reserveMessage: 'Hi RIVR, I would like a seat tonight.',
  /** The header's menu, in grandpokerarena.com's order (#616). */
  menu: {
    club: 'The club',
    room: 'The room',
    games: 'Games',
    membership: 'Membership',
    whatsOn: 'What’s on',
    prizes: 'Prizes and calendar',
    journal: 'Journal',
    visit: 'Visit and contact',
  },
  /** The bar above the header (#616): how to reach the club, and the member app. */
  top: {
    whatsapp: 'WhatsApp',
    instagram: 'Instagram',
    youtube: 'YouTube',
    email: 'info@rivrpoker.com',
    app: 'Member app',
  },
  /** A promotions block while none runs (decision 0166). */
  noPromotions: 'No promotions running.',
  /** The rakeback each table gives (#617), read from the club's rules in force. */
  rewards: {
    table: 'Table',
    rakeback: 'Rakeback',
    rakebackRate: '{percent}% of your rake',
    rakebackPaid: 'Rakeback is paid as bonus chips each Monday.',
  },
  /** The cab the club gives (#617), read from the club's rules in force. */
  outstation: {
    cab: 'Pick-up and drop',
    cabText: 'A cab to the club and home again, once you have played {visits} times this month.',
  },
  /** The footer on every page (#441): where the club is, its columns of links (#616), its 18+ line and copyright. */
  footer: {
    address: 'Upper floor, Glaza, M3M 65th Avenue, Gurugram',
    notice: 'Strictly 18+. Poker is a game of skill.',
    copyright: 'Copyright {year} RIVR Poker Club',
    cookieSettings: 'Cookie settings',
    club: 'The club',
    story: 'About RIVR',
    room: 'The room',
    membership: 'Membership',
    standard: 'The standard',
    play: 'Play',
    games: 'Games',
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
    deleteAccount: 'Delete your account',
    /** Free, confidential helplines for anyone whose play worries them, as grandpokerarena.com lists them. */
    helplines: 'Helplines',
    teleManas: 'Tele-MANAS 14416 (24 hours)',
    iCall: 'iCall 91529 87821',
  },
} as const;
