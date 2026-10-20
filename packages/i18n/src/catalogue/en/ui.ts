/** Copy that @rivr/ui components show themselves: navigation, shells, controls. */
export const ui = {
  brand: {
    /** The letters on the wordmark tiles; not translated. */
    name: 'RIVR',
    /** Letter-spaced beneath the wordmark. */
    tagline: 'Poker club',
    /** The brand line beneath the wordmark on the sign-in screen, and nowhere else (design prompt). */
    motto: 'Skill runs deep.',
    /** The wordmark's accessible name. */
    label: 'RIVR Poker Club',
  },
  playerTabs: {
    /** Accessible name of the player app's bottom tab bar. */
    label: 'Main',
    home: 'Home',
    sessions: 'Sessions',
    balance: 'Balance',
    rewards: 'Rewards',
    learn: 'Learn',
  },
  profile: {
    /** The member's initial, top right, opens Profile. */
    open: 'Profile',
  },
  consoleRail: {
    /** Accessible name of the console's left rail. */
    label: 'Sections',
    groups: {
      floor: 'Floor',
      money: 'Money',
      players: 'Players',
      growth: 'Growth',
      team: 'Team',
    },
    items: {
      liveFloor: 'Live floor',
      waitlist: 'Waitlist',
      tablets: 'Tablets',
      tvs: 'TVs',
      rake: 'Rake',
      dealerPins: 'Dealer PINs',
      checkIn: 'Check-in',
      tournaments: 'Tournaments',
      cage: 'Cage',
      markers: 'Markers',
      treasury: 'Treasury',
      endOfDay: 'End of day',
      members: 'Members',
      kycReview: 'KYC review',
      hostQueue: 'Host queue',
      promotions: 'Promotions',
      jackpots: 'Jackpots',
      highHands: 'High hands',
      rewards: 'Rewards',
      academy: 'Academy',
      academyPayments: 'Academy payments',
      withdrawals: 'Withdrawals',
      staff: 'Staff',
      dealers: 'Dealers',
      sops: 'SOPs',
      reports: 'Reports',
      killSwitch: 'Kill switch',
    },
  },
  web: {
    /** Accessible name of the public website's main navigation. */
    navigation: 'Site',
    /** CareersBlock with no roles open. */
    noOpenings: 'No openings right now.',
    /** MapBlock's link to directions in a maps app. */
    directions: 'Get directions',
    /** GamesBlock and CalendarBlock: `{amount}` is formatted money. */
    buyIn: 'Buy-in {amount}',
    buyInRange: 'Buy-in {min} to {max}',
    straddle: '{amount} straddle',
    notRunning: 'Not running now',
    oneTable: '1 table running',
    tables: '{count} tables running',
    waiting: '{count} waiting',
    noGames: 'No games are set up yet.',
    /** A tournament's start in IST: `Sunday 15 Nov 2026, 16:00`. */
    when: '{weekday} {date}, {time}',
    guaranteed: '{amount} guaranteed',
    /** Two facts on one line: `Buy-in ₹20,000 · ₹500 straddle`. */
    pair: '{first} · {second}',
    noTournaments: 'No tournaments on the calendar yet.',
  },
  /** KycPhoto, in place of a member's photo that is not there. */
  photo: {
    missing: 'No photo',
    failed: 'The photo could not load. Reload the page, or check the member at the desk.',
  },
  /** The dealer tablet's pot keypad (#42). */
  keypad: {
    delete: 'Delete',
  },
  /** The dealer tablet's PIN pad (#41). */
  pinPad: {
    delete: 'Delete',
    /** Read out instead of the dots: never the digits themselves. */
    entered: '{count} of {length} digits entered',
  },
  killSwitch: {
    /** Shown to members on every screen while the venue is frozen. */
    member: 'The club is paused. Staff will assist you.',
    /** Shown to staff on every screen while the venue is frozen. */
    staff: 'Venue frozen. Money, seating and hand entries are refused until it is released.',
  },
  /** The player app with no connection: it opens from its cached shell. */
  offlineBanner: 'Offline. What you see may be out of date.',
  /** A table's seats on the dealer tablet (#59): each a button, read out with who sits there. */
  seatRing: { seat: 'Seat {number}', open: 'Seat {number}, open', taken: 'Seat {number}, {name}' },
  /** The pad a member signs on at the cage (#74). */
  signaturePad: { clear: 'Clear' },
  /** A seated player's call time (#78): `{time}` is what is left, as in "1 h 12 min". */
  callTime: { left: 'Call time {time} left', paused: 'Call time paused, {time} left', done: 'Call time done' },
  /** A console table's filter matching no row (#30): `{query}` is what was typed. */
  dataTable: { noMatch: 'Nothing matches {query}.' },
  /** The offer to add the player app to the home screen, on a member's second visit. */
  installOffer: {
    title: 'RIVR on your home screen',
    prompt: 'Open RIVR in one tap, full screen, like any app.',
    ios: 'In Safari, tap Share, then Add to Home Screen.',
    install: 'Install',
    notNow: 'Not now',
  },
} as const;
