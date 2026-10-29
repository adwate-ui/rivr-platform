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
    /** Food and drink to the seat (#635). */
    food: 'Menu',
    rewards: 'Rewards',
    learn: 'Learn',
  },
  profile: {
    /** The member's initial, top right, opens Profile. */
    open: 'Profile',
  },
  /** QuantityStepper's buttons (#123): `{name}` is what it counts. */
  quantity: { fewer: 'One fewer {name}', more: 'One more {name}' },
  consoleRail: {
    /** Accessible name of the console's left rail. */
    label: 'Sections',
    /** Read after a rail entry's name when things wait on its screen, such as high-hand claims (#317). */
    waiting: '{count} waiting',
    /** Below a desk the rail is a menu (#601): the button that opens it, and the one that closes it. */
    open: 'Menu',
    close: 'Close the menu',
    /** Finds a screen by name, at the top of the rail. */
    goTo: 'Go to',
    noMatch: 'No screen by that name.',
  },
  web: {
    /** Accessible name of the public website's main navigation. */
    navigation: 'Site',
    /** CareersBlock with no roles open. */
    noOpenings: 'No openings right now.',
    /** MapBlock's link to directions in a maps app. */
    directions: 'Get directions',
    /** MapBlock's embedded map (#616), which loads only once the visitor allows maps. */
    mapTitle: 'A map of where the club is',
    mapConsent: 'The map comes from Google Maps, which sets its own cookies. Allow maps to see it here.',
    allowMaps: 'Allow maps',
    /** Accessible name of the bar above the header: the club's number, WhatsApp and socials (#616). */
    contact: 'Contact',
    /** CookieBanner (#616): what the website stores, and the visitor's choice. */
    cookies: {
      title: 'Cookies on this website',
      text: 'The website keeps what it needs to work. Maps are your choice.',
      choices: 'What the website may store',
      essential: 'Essential',
      essentialHelp: 'Always on. Only your choice here.',
      maps: 'Maps',
      mapsHelp: 'The Google map on the Visit page, which sets Google’s cookies.',
      acceptAll: 'Accept all',
      essentialOnly: 'Essential only',
      save: 'Save my choices',
    },
    /** GamesBlock and CalendarBlock: `{amount}` is formatted money. */
    buyIn: 'Buy-in {amount}',
    buyInRange: 'Buy-in {min} to {max}',
    straddle: '{amount} straddle',
    noGames: 'No games are set up yet.',
    /** CalendarBlock's month (#617): its name for a screen reader, and the weekdays' heads, Monday first. */
    monthCalendar: 'The month at a glance',
    weekday: { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' },
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
  /** VenueLogo, in place of the venue's logo that is not there (#397). */
  logo: {
    missing: 'No logo yet',
    failed: 'The logo could not load. Upload it again.',
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
    /** At the top of every website page while the venue is frozen (#278). */
    visitor: 'The club is paused just now. Please check back soon.',
    /** Shown to staff on every screen while the venue is frozen. */
    staff: 'Venue frozen. Money, seating and hand entries are refused until it is released.',
  },
  /** The player app with no connection: it opens from its cached shell. */
  offlineBanner: 'Offline. What you see may be out of date.',
  /** A table's seats on the dealer tablet (#59): each a button, read out with who sits there. */
  seatRing: { seat: 'Seat {number}', open: 'Seat {number}, open', taken: 'Seat {number}, {name}' },
  /** A Learn review's heatmap (#136): the four bands a cell falls in. */
  heatmap: { legend: 'Bands', bands: { strong: 'Strong', fair: 'Fair', weak: 'Weak', thin: 'Too few answers' } },
  /** The pad a member signs on at the cage (#74). */
  signaturePad: { clear: 'Clear' },
  /** A seated player's call time (#78): `{time}` is what is left, as in "1 h 12 min". */
  callTime: { left: 'Call time {time} left', paused: 'Call time paused, {time} left', done: 'Call time done' },
  /** A console table's filter matching no row (#30): `{query}` is what was typed. */
  dataTable: {
    noMatch: 'Nothing matches {query}.',
    /** Sorting on a phone, where the header row is hidden (#605). */
    sortBy: 'Sort by',
    sortTable: 'Sort {table}',
    sortByColumn: 'Sort by {column}',
    sortedBy: 'Sorted by {column}, {direction}',
    ascending: 'ascending',
    descending: 'descending',
    /** A console table's export (#102): the rows as shown, recorded in the audit log first. */
    exportCsv: 'Export CSV',
    exportXlsx: 'Export XLSX',
    exportFailed: 'The export was not recorded, so nothing was saved. Try again.',
  },
  /** The offer to add the player app to the home screen, on a member's second visit. */
  installOffer: {
    title: 'RIVR on your home screen',
    prompt: 'Open RIVR in one tap, full screen, like any app.',
    ios: 'In Safari, tap Share, then Add to Home Screen.',
    install: 'Install',
    notNow: 'Not now',
  },
  /** The digital membership card (#67): `{number}` is the membership number. */
  membershipCard: { label: 'Membership card', number: 'No. {number}' },
  /** A CCTV recording's playback (#122): asked for, then opened in a new tab at the moment. */
  playback: {
    label: 'Playback',
    open: 'Open {camera} at this moment',
    failures: {
      no_camera: 'No camera saw this.',
      not_allowed: 'You cannot see this recording.',
      unavailable: 'The recording link did not come.',
    },
  },
  /** Printed matter, receipts and A4 documents: the club's registration beneath its address. */
  paper: { gstin: 'GSTIN {gstin}' },
} as const;
