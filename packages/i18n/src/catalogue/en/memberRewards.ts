/**
 * The player app's Rewards tab (#152; design prompt "Rewards"): points and tier, the catalogue (#145), the
 * member's redemptions and the RIVR League (#147). Registered when the tab first opens, so the app's first
 * load carries none of it (#344).
 */
export const memberRewards = {
  title: 'Rewards',
  points: 'Points',
  /** The member's tier, beside their points: `Member`, `Black card`. */
  tier: 'Your tier: {tier}',
  catalogue: 'Catalogue',
  noRewards: 'No rewards here yet.',
  /** The catalogue's filter: all rewards, or one kind. */
  show: 'Show',
  all: 'All',
  kinds: {
    tournament_seat: 'Tournament seat',
    fnb_upgrade: 'F&B upgrade',
    merchandise: 'Merchandise',
    hotel_night: 'Hotel night',
  },
  /** A reward's price: `4,000 points`. */
  price: '{points} points',
  onePoint: '1 point',
  /** How many are left, and where to collect it: `42 left · At the host desk`. */
  leftLine: '{count} left · {detail}',
  redeem: 'Redeem',
  redeemName: 'Redeem {name}',
  /** Asked before the points are taken. */
  confirm: 'Redeem {name} for {points} points?',
  confirmYes: 'Yes, redeem',
  cancel: 'Cancel',
  /** After a redemption: where to collect it. */
  redeemed: 'Redeemed. {detail}.',
  failures: {
    not_allowed: 'The catalogue is not part of your tier.',
    invalid: 'That did not go through. Please try again.',
    stock_changed: 'That did not go through. Please try again.',
    handed_over: 'That did not go through. Please try again.',
    not_on_offer: 'That reward is no longer on offer, or none are left.',
    price_changed: 'The price changed. The catalogue now shows it.',
    not_enough_points: 'You do not have enough points for that yet.',
    stopped: 'Your account is paused. Please speak to the front desk.',
    paused: 'The club is paused. Please try again later.',
    unavailable: 'That did not go through. Check your connection and try again.',
  },
  yourRedemptions: 'Your redemptions',
  noRedemptions: 'Nothing redeemed yet.',
  /** A redemption: `RIVR hoodie · 4,000 points`. */
  redemptionLine: '{name} · {points} points',
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
