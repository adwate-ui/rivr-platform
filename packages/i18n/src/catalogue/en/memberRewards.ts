/**
 * The player app's Rewards tab (#152; design prompt "Rewards"): points and tier, the catalogue (#145), the
 * member's redemptions and the RIVR League (#147). Registered when the tab first opens, so the app's first
 * load carries none of it (#344).
 */
export const memberRewards = {
  title: 'Rewards',
  /** Someone signed in who is not a member. */
  notMember: 'Rewards are for members.',
  points: 'Points',
  /** Points the club gave locked (#645), under the points they spend: `And 500 locked, for the club to release`. */
  locked: 'And {points} locked, for the club to release',
  /** Hotel nights earned by the hours played (#146), shown as `1.25`. */
  nights: 'Hotel nights',
  /** The member's tier, beside their points: `Member`, `Black card`. */
  tier: 'Your tier: {tier}',
  catalogue: 'Catalogue',
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
  noneLeft: 'None left',
  redeemName: 'Redeem {name}',
  /** Asked before the points are taken. */
  confirm: 'Redeem {name} for {price}?',
  confirmYes: 'Yes, redeem',
  cancel: 'Cancel',
  /** After a redemption: where to collect it. */
  redeemed: 'Redeemed. Collect it: {detail}',
  /** Refer a friend (#151): the code is RIVR and the member's number. */
  referral: {
    title: 'Refer a friend',
    how: 'Bonus chips for you both when a friend joins from your link and buys in.',
    /** `{chips}`: a count of bonus chips, `5,000` (#627). */
    howAmount: '{chips} bonus chips each when a friend joins from your link and buys in.',
    referredOne: 'You have referred 1 friend.',
    referred: 'You have referred {count} friends.',
    copy: 'Copy my link',
    copied: 'Link copied',
    copyFailed: 'Not copied. Share your card instead.',
    /** The share card (#153): what it says, and the share, which carries the member's link. */
    card: {
      brand: 'RIVR',
      heading: 'Play with me at RIVR',
      codeLabel: 'My code',
      footer: 'Join from my link. On your first buy-in, we both get bonus chips.',
      alt: 'Referral card with the code {code}',
      share: 'Share my card',
      message: 'Join me at RIVR Poker Club.',
      failed: 'Not shared. Try again.',
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
  noRedemptions: 'Nothing redeemed yet.',
  /** A redemption and its price: `RIVR hoodie · 4,000 points`, `Partner hotel · 2 nights`. */
  redemptionLine: '{name} · {price}',
  /** Still to collect: where. */
  waiting: 'To collect: {detail}',
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
