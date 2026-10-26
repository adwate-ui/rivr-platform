/** The rewards catalogue (#145, decision 0181) and the RIVR League (#147, decision 0182), as the console keeps them. */

/** Each kind of reward the catalogue holds, by its key. */
const kinds = {
  tournament_seat: 'Tournament seat',
  fnb_upgrade: 'F&B upgrade',
  merchandise: 'Merchandise',
  hotel_night: 'Hotel night',
} as const;

/** The console's Rewards screen: the catalogue (rewards.manage) and redemptions to hand over (rewards.hand_over). */
export const rewards = {
  title: 'Rewards',
  notAllowed: 'Your role does not include rewards. Ask an admin if you need it.',
  catalogue: 'Catalogue',
  noRewards: 'No rewards here yet.',
  /** The catalogue's filter: all rewards, or one kind. */
  show: 'Show',
  all: 'All',
  kinds,
  /** The redemptions' columns. */
  reward: 'Reward',
  /** A reward's second line: its kind and where to collect it, `Merchandise · At the host desk`. */
  itemLine: '{kind} · {detail}',
  points: '{points} points',
  onePoint: '1 point',
  /** How many are left, or none counted. */
  left: '{count} left',
  noLimit: 'No limit',
  live: 'Live',
  retired: 'Retired',
  edit: 'Edit',
  /** The Edit button's name, and the form's heading while it changes that reward. */
  editName: 'Edit {name}',
  /** The action beside the heading, and the form's heading for a new reward. */
  newReward: 'New reward',
  kind: 'Kind',
  name: 'Name',
  invalidName: 'Give it a name of up to 80 characters.',
  detail: 'Where to collect it',
  detailHint: 'The member reads this after redeeming: “At the host desk”.',
  invalidDetail: 'Say where to collect it, in up to 200 characters.',
  price: 'Points',
  invalidPrice: 'A whole number of points from 1 to 1,00,00,000.',
  stock: 'How many are left',
  stockHint: 'Leave blank for no limit.',
  invalidStock: 'A whole number, or blank for no limit.',
  onOffer: 'On offer',
  onOfferHint: 'Members see it and can redeem it.',
  save: 'Save',
  cancel: 'Cancel',
  saved: '{name} is saved.',
  /** Redemptions, for staff who hand them over. */
  waiting: 'Waiting to hand over',
  noneWaiting: 'Nothing is waiting to be handed over.',
  handedOver: 'Handed over in the last 30 days',
  noneHandedOver: 'Nothing handed over in the last 30 days.',
  member: 'Member',
  /** The member and their number: `Mihir Shah · No. 1213`. */
  memberLine: '{name} · No. {number}',
  redeemed: 'Redeemed',
  handedOverBy: 'Handed over',
  /** Who handed it over, and when: `Karan Gill, Sun 15 Nov, 22:40`. */
  handedOverLine: '{name}, {when}',
  handOver: 'Hand over',
  handOverName: 'Hand {reward} over to {name}',
  failures: {
    not_allowed: 'Your role does not allow this.',
    invalid: 'That did not save. Check the values and try again.',
    stock_changed: 'Members redeemed this reward while you were editing. Open it again to see how many are left.',
    handed_over: 'That was handed over already. The list now shows who did.',
    not_on_offer: 'That reward is not on offer, or none are left.',
    price_changed: 'The price changed. The catalogue now shows it.',
    not_enough_points: 'Not enough points.',
    stopped: 'That member is frozen.',
    paused: 'The venue is frozen. Rewards change again once it is released.',
    unavailable: 'That did not go through. Check the connection and try again.',
  },
} as const;

/** The console's League screen: standings by month or season, and the seasons (rewards.manage). */
export const league = {
  title: 'League',
  notAllowed: 'Your role does not include the League. Ask an admin if you need it.',
  /** Which standings to show. */
  period: 'Standings for',
  thisMonth: 'This month',
  noNames: 'Standings by name are for staff who read members.',
  noStandings: 'No League points yet for this period.',
  place: 'Place',
  member: 'Member',
  /** The member and their number: `Mihir Shah · No. 1213`. */
  memberLine: '{name} · No. {number}',
  cash: 'Cash',
  tournaments: 'Tournaments',
  total: 'Points',
  seasons: 'Seasons',
  noSeasons: 'No seasons yet.',
  edit: 'Edit',
  /** A season's line: `Season one · November 2026 to April 2027`. */
  seasonLine: '{name} · {first} to {last}',
  newSeason: 'New season',
  editSeason: 'Edit {name}',
  name: 'Name',
  invalidName: 'Give the season a name of up to 80 characters.',
  firstMonth: 'First month',
  lastMonth: 'Last month',
  monthHint: 'As 2026-11.',
  invalidMonth: 'A month as 2026-11.',
  lastBeforeFirst: 'The last month cannot come before the first.',
  save: 'Save',
  cancel: 'Cancel',
  saved: '{name} is saved.',
  failures: {
    not_allowed: 'Your role does not allow this.',
    invalid: 'That season overlaps another, or its months are out of order.',
    paused: 'The venue is frozen. Seasons change again once it is released.',
    unavailable: 'That did not go through. Check the connection and try again.',
  },
} as const;
