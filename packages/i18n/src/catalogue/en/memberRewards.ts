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
  /** A cab (#140): shown once the member has the visits this month the club asks. */
  cab: {
    title: 'Cab',
    how: 'You have {visits} visits this month, so RIVR sends a cab to bring you or take you home.',
    kind: 'Pickup or drop',
    kinds: { pickup: 'Pickup to the club', drop: 'Drop home' },
    address: 'Where',
    time: 'At (24-hour time, as 21:30)',
    request: 'Ask for the cab',
    asked: 'Asked: {kind} at {time}, {address}.',
    failures: {
      not_eligible: 'A cab comes with more visits this month.',
      invalid: 'Say where, and a time as 21:30.',
      not_allowed: 'Cabs are not part of your tier.',
      paused: 'The club is paused. Ask again later.',
      unavailable: 'That did not go through. Try again.',
    },
  },
  /** Refer a friend (#151): the code is RIVR and the member's number. */
  referral: {
    title: 'Refer a friend',
    how: 'When a friend signs up from your link and first buys in, you both get a bonus.',
    /** `{chips}`: a count of bonus chips, `5,000` (#627). */
    howAmount: 'When a friend signs up from your link and first buys in, you each get {chips} bonus chips.',
    referredOne: 'You have referred 1 friend.',
    referred: 'You have referred {count} friends.',
    copy: 'Copy my link',
    copied: 'Link copied',
    copyFailed: 'The link could not be copied. Share your card instead.',
    /** The share card (#153): what it says, and the share, which carries the member's link. */
    card: {
      brand: 'RIVR',
      heading: 'Play with me at RIVR',
      codeLabel: 'My code',
      footer: 'Sign up from my link. On your first buy-in, we both get a bonus.',
      alt: 'Referral card with the code {code}',
      share: 'Share my card',
      message: 'Join me at RIVR Poker Club. Sign up from this link.',
      failed: 'The card could not be shared. Try again.',
    },
  },
  failures: {
    not_allowed: 'The catalogue is not part of your tier.',
    invalid: 'That did not go through. Please try again.',
    stock_changed: 'That did not go through. Please try again.',
    handed_over: 'That did not go through. Please try again.',
    not_on_offer: 'That reward is no longer on offer, or none are left.',
    price_changed: 'The price changed. The catalogue now shows it.',
    not_enough_points: 'You do not have enough points for that yet.',
    not_enough_nights: 'You do not have enough hotel nights for that yet.',
    stopped: 'Your account is paused. Please speak to the front desk.',
    paused: 'The club is paused. Please try again later.',
    switched_off: 'Redemptions are switched off for now. Try again later.',
    cancelled: 'That redemption was cancelled, and its points went back.',
    unavailable: 'That did not go through. Check your connection and try again.',
  },
  yourRedemptions: 'Your redemptions',
  noRedemptions: 'Nothing redeemed yet.',
  /** A redemption and its price: `RIVR hoodie · 4,000 points`, `Partner hotel · 2 nights`. */
  redemptionLine: '{name} · {price}',
  /** Still to collect: where. */
  waiting: 'To collect: {detail}',
  /** Handed over, and when: `Collected 15 Nov`. */
  collected: 'Collected {date}',
  league: 'RIVR League',
  thisMonth: 'This month',
  /** The season's name and months: `Season one · November 2026 to April 2027`. */
  seasonLine: '{name} · {first} to {last}',
  noStandings: 'No League points yet. Play cash games and tournaments to earn them.',
  /** The member's own row on the board. */
  you: 'You',
  /** A member who hid their name on the TVs (#326). */
  hiddenName: 'A member',
  /** A place: `3`, its name, and its points. */
  placeLine: '{place}. {name}',
  leaguePoints: '{points} points',
} as const;
