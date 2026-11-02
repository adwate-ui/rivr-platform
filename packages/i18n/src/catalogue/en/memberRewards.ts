/**
 * The player app's Rewards tab (#152; design prompt "Rewards"): points and tier, the catalogue (#145), the
 * member's redemptions and the RIVR League (#147). Registered when the tab first opens, so the app's first
 * load carries none of it (#344).
 */
export const memberRewards = {
  title: 'Rewards',
  /** Someone signed in who is not a member. */
  notMember: 'Rewards are for members.',
  /** Points the club gave locked (#645), under the points they spend: `And 500 locked, for the club to release`. */
  locked: 'And {points} locked, for the club to release',
  /** Hotel nights earned by the hours played (#146), shown as `1.25`. */
  nights: 'Hotel nights',
  noRewards: 'No rewards here yet.',
  /** The catalogue's filter: all rewards, or one kind. */
  show: 'Show',
  all: 'All',
  kinds: {
    tournament_seat: 'Tournament seats',
    fnb_upgrade: 'F&B upgrades',
    merchandise: 'Merchandise',
    hotel_night: 'Hotel nights',
  },
  /** A reward's price: `4,000 points`. */
  price: '{points} points',
  onePoint: '1 point',
  /** A hotel night's price: `2 nights`. */
  nightsPrice: '{nights} nights',
  oneNight: '1 night',
  /** How many are left, and where to collect it: `42 left · At the host desk`. */
  leftLine: '{count} left · {detail}',
  redeem: 'Redeem',
  /** The redesign (decision 0320): the balance's word, the next reward, a reward out of reach, and the redeem sheet. */
  pointsWord: 'points',
  next: 'Next: {name}',
  /** Every reward in points is within reach: the bar full. */
  allUnlocked: 'Everything unlocked',
  /** `750 to go`. */
  toGo: '{points} to go',
  cost: 'Cost',
  balanceAfter: 'Balance after',
  redeemedToast: 'Redeemed',
  readyToCollect: 'Ready to collect',
  noneLeft: 'None left',
  redeemName: 'Redeem {name}',
  cancel: 'Cancel',
  /** Refer a friend (#151): the code is RIVR and the member's number. */
  referral: {
    title: 'Refer a friend',
    how: 'Bonus chips for you both when a friend joins from your link and buys in.',
    /** The redesign's card (decision 0320): `{chips}` is `1,000`. */
    offer: '{chips} bonus chips each when a friend joins and buys in.',
    joined: '{count} joined',
    copyLink: 'Copy link',
    shareInvite: 'Share invite',
    linkCopied: 'Invite link copied',
    copyFailed: 'Not copied. Use Share invite instead.',
    /** What Share invite sends with the member's link. */
    card: {
      message: 'Join me at RIVR Poker Club.',
    },
  },
  failures: {
    not_allowed: 'The catalogue is not part of your tier.',
    invalid: 'Not sent. Try again.',
    stock_changed: 'Not sent. Try again.',
    handed_over: 'Not sent. Try again.',
    not_on_offer: 'No longer available.',
    price_changed: 'The price has changed.',
    not_enough_points: 'You do not have enough points for that yet.',
    not_enough_nights: 'You do not have enough hotel nights for that yet.',
    stopped: 'Account paused. Ask at the front desk.',
    paused: 'The club is paused. Try again later.',
    switched_off: 'Redemptions are paused.',
    cancelled: 'That redemption was cancelled, and its points went back.',
    unavailable: 'Not sent. Try again.',
  },
  yourRedemptions: 'Your redemptions',
  /** Handed over, and when: `Collected 15 Nov`. */
  collected: 'Collected {date}',
  /** A redemption staff cancelled (decision 0302), with their reason; the points are back. */
  cancelled: 'Cancelled: {reason}',
  league: 'RIVR League',
  thisMonth: 'This month',
  /** The season's name and months: `Season one · November 2026 to April 2027`. */
  seasonLine: '{name} · {first} to {last}',
  noStandings: 'No League points yet.',
  /** The member's own row on the board. */
  you: 'You',
  /** A member who hid their name on the TVs (#326). */
  hiddenName: 'A member',
  /** A place: `3`, its name, and its points. */
  placeLine: '{place}. {name}',
  leaguePoints: '{points} points',
} as const;
