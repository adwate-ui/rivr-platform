/** Profile, the player's fourth tab. */
export const profile = {
  title: 'Profile',
  /** Profile's three groups and their rows (decision 0320). */
  account: 'Account',
  club: 'Club',
  verified: 'Verified',
  /** A member let in by their selfie, whose identity is checked at the club (decision 0502). */
  atTheDesk: 'At the desk, first visit',
  sendFeedback: 'Send feedback',
  feedbackSent: 'Feedback sent',
  whatHappened: 'What happened?',
  send: 'Send',
  /** Under the name: `Founders' Circle · +91 90000 00901`. */
  tierPhone: '{tier} · {phone}',
  /** Under it: the number the Door finds the member by, which only the card showed. */
  memberNumber: 'Member number {number}',
  identity: 'ID check',
  notifications: 'Notifications',
  /** The switch for push on this phone (#139). */
  phonePush: 'Notifications on this phone',
  phonePushBlocked: "Blocked in your phone's settings.",
  phonePushUnsupported: 'Not supported here. Open RIVR from your home screen.',
  /** Under a phone that cannot take notifications, above the kinds of notification (F-169). */
  pushOffNote: 'These apply once notifications are on.',
  /** In the native app, Android's name for the lock-screen status's notifications, in the phone's settings (decision 0361). */
  liveStatusChannel: 'Live status',
  seatCalls: 'Seat calls',
  seatCallsHint: 'When your seat is ready',
  callTime: 'Call time',
  callTimeHint: 'When your call time ends',
  tournamentStarts: 'Tournaments',
  tournamentStartsHint: 'When a tournament starts, moves or is withdrawn',
  /** Bonus chips added or used (decision 0504). */
  bonusChips: 'Bonus',
  bonusChipsHint: 'When Bonus is added or used',
  marketing: 'Offers',
  marketingHint: 'By WhatsApp and app. Stop any time.',
  /** The cookie banner's analytics choice, changed later (decision 0298). */
  analytics: 'Analytics',
  analyticsHint: 'Google Analytics and Meta pixel on this phone',
  saveFailed: 'Not saved. Try again.',
  /** Offered on Home once the member has a place on a list, while this phone's push is off (F3-26). */
  seatReadyOffer: 'Get seat calls on this phone.',
  seatReadyYes: 'Turn on',
  /** Turn on, named for a screen reader: the button stands apart from its line. */
  seatReadyYesName: 'Turn on seat calls on this phone',
  seatReadyNotNow: 'Not now',
  seatReadyOn: 'This phone will tell you when your seat is ready.',
  nameOnTvs: 'Name on club TVs',
  /** The prototype's "seat number" is not what the TV shows: off, it shows the member's place on the list. */
  nameOnTvsHint: 'Off shows your place instead, or your member number on the hours board',
  /** The page the store app shows when the hosted app cannot load at start (decision 0577). */
  offlineStart: { title: 'No network', body: 'Opens when your network is back.', retry: 'Retry' },
  /** How a member asks to delete their account (#813, decision 0574): a super admin completes it with the erasure. */
  deleteAccount: 'Delete my account',
  deleteRequested: 'Requested {date}',
  deleteWhen: 'RIVR erases your account and its data within 7 days, once nothing is open at the club.',
  deleteForfeit: 'Your Bonus is forfeited.',
  deleteKept: 'Play records the law requires are kept, without your name or number.',
  deleteConfirmed: 'A WhatsApp message confirms it when done.',
  deleteSend: 'Send request',
  deleteSent: 'Request sent.',
  deleteNotSent: 'Not sent. Try again.',
};

/** House rules in the player's Settings (#637): the club's house rules, from its website. */
export const playerHouseRules = {
  title: 'House rules',
  /** Under the title (brief 3.10), where the club has written no line of its own. */
  appliesAtEveryTable: 'The floor applies these at every table.',
  empty: 'The club has not published its house rules yet.',
};
