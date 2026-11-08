import { consoleUi } from './uiConsole.ts';

/** Copy that @rivr/ui components show themselves: navigation, shells, controls. */
export const ui = {
  /** The console v3 redesign's components (decision 0465). */
  console: consoleUi,
  /** The browser tab's title on a screen (F5-03): `Check-in · RIVR`. */
  screenTitle: '{title} · RIVR',
  /** The same, led by how many urgent items wait for staff (decision 0301): `(3) Top-ups · RIVR`. */
  screenTitleCounted: '({count}) {title} · RIVR',
  /** Said to a screen reader as new urgent work arrives on the console (decision 0301). */
  urgentChime: {
    waiting: '{count} urgent waiting',
  },
  /** A shell's first stop for a keyboard (F5-03). */
  skipToContent: 'Skip to content',
  captcha: {
    /** Cloudflare's check, which every sign-in code request carries, did not load or failed (F1-15). */
    failed: 'Security check incomplete. Try again.',
  },
  brand: {
    /** The letters on the wordmark tiles; not translated. */
    name: 'RIVR',
    /** Letter-spaced beneath the wordmark. */
    tagline: 'Poker club',
    /** The brand line beneath the wordmark on the sign-in screen, and nowhere else (design prompt). */
    motto: 'Skill runs deep.',
    /** The wordmark's accessible name. */
    label: 'RIVR Poker Club',
    /** On the share image's photograph while it is a concept (decision 0289). */
    conceptNote: 'Concept visualisation',
  },
  /** The player redesign's alert system and sheets (decision 0320). */
  banner: {
    dismiss: 'Dismiss',
  },
  toast: {
    undo: 'Undo',
  },
  picker: {
    done: 'Done',
    chooseOne: 'Choose one',
    chooseAny: 'Choose any',
  },
  playerTabs: {
    /** Accessible name of the player app's bottom tab bar. */
    label: 'Main',
    /** The member's own night (decision 0320): the first tab. */
    home: 'Home',
    /** The membership card, a tab since the redesign. */
    card: 'Card',
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
    /** On a phone, what opens the website's links. */
    menu: 'Menu',
    /** CareersBlock with no roles open. */
    noOpenings: 'No openings.',
    /** MapBlock's link to directions in a maps app. */
    directions: 'Get directions',
    /** MapBlock's embedded map (#616), which loads only once the visitor allows maps. */
    mapTitle: 'A map of where the club is',
    mapConsent: 'Google Maps sets its own cookies. Allow maps to see it.',
    allowMaps: 'Allow maps',
    /** Accessible name of the bar above the header: the club's number, WhatsApp and socials (#616). */
    contact: 'Contact',
    /** CookieBanner (#616): what the website stores, and the visitor's choice. */
    cookies: {
      title: 'Cookies on this website',
      text: 'Essential cookies only, unless you allow maps or analytics.',
      /** The player app's banner (decision 0298): no map there, so analytics alone. */
      appTitle: 'Cookies in this app',
      appText: 'Essential storage only, unless you allow analytics.',
      choices: 'What the website may store',
      essential: 'Essential',
      essentialHelp: 'Always on.',
      maps: 'Maps',
      mapsHelp: 'The Google map on the Visit page.',
      analytics: 'Analytics and ads',
      analyticsHelp: 'Google Analytics and the Meta pixel, to count visits and measure adverts.',
      acceptAll: 'Accept all',
      essentialOnly: 'Essential only',
      /** Opens the two choices under the banner's buttons. */
      choose: 'Choose',
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
    failed: 'Photo not loaded. Reload, or check at the desk.',
  },
  /** VenueLogo, in place of the venue's logo that is not there (#397). */
  logo: {
    missing: 'No logo yet',
    failed: 'Logo not loaded. Upload it again.',
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
  /** CameraCapture: a photo taken there and then, the selfie or a member's photo at the desk (K-07). */
  camera: {
    /** The live picture, read out. */
    preview: 'Camera',
    starting: 'Starting the camera',
    faceGuide: 'Fit your face in the oval.',
    take: 'Take photo',
    /** The photo just taken, read out. */
    review: 'Your photo',
    use: 'Use photo',
    retake: 'Retake',
    blocked: 'Camera blocked. Allow it in site settings.',
    /** In a browser on an iPhone or iPad: Settings' search finds the browser's camera switch on every iOS (decision 0423). */
    blockedIphone: 'Camera blocked. In Settings, search for {browser} and allow Camera, then come back here.',
    /** On Android, where the site's permissions open from the icon left of the address (decision 0423). */
    blockedAndroid: 'Camera blocked. Tap the icon left of the address, then Permissions, allow Camera and tap Try again.',
    none: 'No camera here. Carry on with a phone.',
    failed: 'Camera did not start. Try again.',
    tryAgain: 'Try again',
    /** Beside a QR code that opens the same step on a phone. */
    onPhone: 'Scan with your phone to carry on there.',
    phoneLink: 'Link to this step on your phone',
  },
  /** The redesign's selfie camera (decision 0320): its live line, three tips and the review. */
  selfie: {
    back: 'Back',
    title: 'Selfie',
    closer: 'Move closer',
    steady: 'Hold still',
    capturing: 'Capturing',
    tipLight: 'Even light',
    tipCap: 'No cap or sunglasses',
    tipAlone: 'Only you',
    reviewTitle: 'Use this photo?',
  },
  /** StepList: where a person is in a flow of steps, read out beside each step's name. */
  steps: {
    done: 'done',
    current: 'current step',
  },
  killSwitch: {
    /** Shown to members on every screen while the venue is frozen. */
    member: 'The club is paused. Ask a member of staff.',
    /** At the top of every website page while the venue is frozen (#278). */
    visitor: 'The club is paused. Check back soon.',
    /** Shown to staff on every screen while the venue is frozen. */
    staff: 'Venue frozen. Changes are refused until it is released.',
  },
  /** The player app with no connection: it opens from its cached shell. */
  offlineBanner: 'No connection. What you see may be out of date.',
  /** A screen's data stopped refreshing: when it last came. */
  staleNotice: 'Not updated since {time}. Check the connection.',
  /** A table's seats on the dealer tablet (#59): each a button, read out with who sits there. */
  seatRing: { seat: 'Seat {number}', open: 'Seat {number}, open', taken: 'Seat {number}, {name}' },
  /** A Learn review's heatmap (#136): the four bands a cell falls in. */
  heatmap: { legend: 'Bands', bands: { strong: 'Strong', fair: 'Fair', weak: 'Weak', thin: 'Too few answers' } },
  /** The pad a member signs on at the cage (#74). */
  signaturePad: { clear: 'Clear' },
  /** A seated player's call time (#78): `{time}` is what is left, as in "1 h 12 min". */
  /** WaitTimer (decision 0299): past its target, `{time}` is the clock, 01:35. */
  waitTimer: { late: 'Late {time}' },
  callTime: {
    left: 'Call time {time} left',
    paused: 'Call time paused, {time} left',
    done: 'Call time complete',
    /** Above the time, set large on the member's seat card. */
    figureLeft: 'Call time left',
    figurePaused: 'Call time paused',
    /** CallTimeChoice (decision 0299): the call time the floor gives a player it seats. */
    choose: 'Call time',
    custom: 'Custom',
    minutes: 'Minutes',
    minutesHint: 'Up to 1,440 (a day).',
  },
  /** A console table's filter matching no row (#30): `{query}` is what was typed. */
  dataTable: {
    noMatch: 'Nothing matches {query}.',
    /** A table's own filters (owner, 8 Nov): the button, with how many are in force, and what an export records. */
    filters: 'Filters',
    filtersCount: 'Filters, {count} in force',
    clearFilters: 'Clear filters',
    noFilterMatch: 'Nothing matches these filters.',
    filterInForce: '{label}: {value}',
    or: ' or ',
    /** Sorting on a phone, where the header row is hidden (#605). */
    sortBy: 'Sort by',
    sortTable: 'Sort {table}',
    sortByColumn: 'Sort by {column}',
    sortedBy: 'Sorted by {column}, {direction}',
    ascending: 'ascending',
    descending: 'descending',
    /**
     * A console table's export (#102): the rows as shown, recorded in the audit log first. One small control, as the
     * prototype has it, whose menu offers each format; `{what}` is the table's name.
     */
    export: 'Export',
    exportNamed: 'Export {what}',
    exportCsv: 'Export CSV',
    exportXlsx: 'Export XLSX',
    exportFailed: 'Export not saved. Try again.',
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
