/** Profile, behind the member's initial. */
export const profile = {
  title: 'Profile',
  identity: 'Identity',
  kycIncomplete: 'KYC incomplete. Finish it to join a table.',
  kycReview: 'Pending. Bring your Aadhaar and PAN to the front desk.',
  kycVerified: 'Verified · DigiLocker and selfie',
  kycRefused: 'Not verified. Ask at the front desk.',
  finishKyc: 'Finish identity check',
  alerts: 'Waitlist alerts',
  games: 'Games',
  /** The stake for waitlist alerts (#206): one of the club's, or any. */
  stake: 'Stake',
  anyStake: 'Any',
  nlh: 'NLH',
  plo: 'PLO',
  tournaments: 'Tournaments',
  notifications: 'Notifications',
  /** The switch for push on this phone (#139). */
  phonePush: 'Notifications on this phone',
  /** Winner cards (#155): each win as a card, shared on the club's social only while the member says so. */
  winnerCards: 'Winner cards',
  winnerCardsHint: "RIVR posts a card of your win only while you share it. Stop sharing and it comes down.",
  winnerCardTournament: '{event}: {prize}',
  winnerCardHighHand: 'High hand: {prize}',
  winnerCardJackpot: 'Bad-beat jackpot: {prize}',
  winnerCardDrawing: 'Your card is being drawn. It is ready by 17:00 the day after your win at the latest.',
  winnerCardSee: 'See the card',
  /** Named by the card and its date, so each card's switch is told apart. */
  winnerCardShare: "Share {what} from {date} on RIVR's social",
  phonePushBlocked: "Blocked in your phone's settings.",
  phonePushUnsupported: 'Not supported here. Open RIVR from your home screen.',
  seatCalls: 'Seat calls',
  seatCallsHint: 'When your seat is ready.',
  callTime: 'Call time',
  callTimeHint: 'When your call time is complete.',
  withdrawals: 'Withdrawals',
  withdrawalsHint: 'When a withdrawal is sent.',
  tournamentStarts: 'Tournaments',
  tournamentStartsHint: 'When your tournament starts.',
  marketing: 'Promotions and offers',
  marketingHint: 'WhatsApp and app. Stop any time.',
  /** The cookie banner's analytics choice, changed later (decision 0298). */
  analytics: 'Analytics and ads',
  analyticsHint: 'Google Analytics and the Meta pixel on this phone. Turned off, they stop the next time you open the app.',
  saveFailed: 'Not saved. Try again.',
  /** Offered on Home once the member has a place on a list, while this phone's push is off (F3-26). */
  seatReadyOffer: 'Seat calls on this phone, even with the app closed.',
  seatReadyYes: 'Tell me when my seat is ready',
  seatReadyNotNow: 'Not now',
  seatReadyOn: 'This phone will tell you when your seat is ready.',
  /** Whether the TVs' waitlist board names the member (#326). */
  privacy: 'Privacy',
  nameOnTvs: 'Show my name on the club\'s TVs',
  nameOnTvsHint: 'On, your first name and initial. Off, your place, such as Player 2.',
  /** How a member asks for their personal data to be erased (F3-27): only a super admin erases, at the club. */
  erasure: 'To erase your data, ask at the front desk. The privacy notice says what is kept.',
  /** Shown only to a member with an Academy seat, under the heading RIVR Academy. */
  academyBookings: 'Your Academy bookings',
  /** The way to the membership card (#71). */
  card: 'Membership card',
  showCard: 'Show card',
  /** Limits and self-exclusion (#56), as in the prototype's Profile. */
  limits: 'Limits',
  sessionReminder: 'Session reminder',
  reminderNone: 'None',
  reminderHours: '{hours}h',
  selfExclusion: 'Self-exclusion',
  takeBreak: 'Take a break',
  breakIntro: 'Tables and waitlists close to you. A break cannot be shortened.',
  break1: '24 hours',
  break7: '7 days',
  break30: '30 days',
  /** `{until}` is when a break would end: Wed 17 Feb, 00:10. */
  breakUntil: 'Until {until}',
  /** The break chosen, asked once more before it starts (F3-15). */
  breakAsk: 'Break until {until}? It cannot be shortened.',
  breakYes: 'Yes, take the break',
};

/** House rules in the player's Settings (#637): the club's house rules and the legal standing, from its website. */
export const playerHouseRules = {
  title: 'House rules',
  open: 'Read the house rules',
  /** One rule, with its number: `1. Members only, 18 and over.` */
  rule: '{number}. {rule}',
  /** Above the legal cases when the website gives them no heading. */
  legal: 'The legal standing',
  /** One case: `1996 · K.R. Lakshmanan v. State of Tamil Nadu`. */
  case: '{when} · {title}',
  empty: 'The club has not published its house rules yet.',
};
