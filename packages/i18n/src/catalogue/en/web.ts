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
