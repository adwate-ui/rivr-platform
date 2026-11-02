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
  /** Points by hand (#645): staff who keep the rewards give a member points, earned or locked, and release locked ones. */
  byHand: {
    heading: 'Points by hand',
    phone: 'Member’s mobile number',
    find: 'Find',
    notFound: 'No member here has that number.',
    /** The member found: `Mihir Shah · No. 1213`. */
    member: '{name} · No. {number}',
    earned: 'Earned',
    locked: 'Locked',
    lockedHint: 'Rewards spend earned points only.',
    points: 'Points to give or release',
    reason: 'Reason',
    giveEarned: 'Give as earned',
    giveLocked: 'Give as locked',
    unlock: 'Release',
    /** League points by hand (L-01): they rank the member this month, and are never spent. */
    giveLeague: 'Give League points',
    done: {
      earned: '{points} points given to {name} to spend.',
      locked: '{points} points locked for {name}.',
      unlock: '{points} of {name}’s locked points released to spend.',
      league: '{points} League points given to {name}.',
    },
    failures: {
      not_allowed: 'Not in your role. Ask an admin.',
      no_member: 'No member here has that number.',
      invalid: '1 to 10,00,000 points and a reason of 3 to 200 characters.',
      not_enough_locked: 'They hold fewer locked points than that.',
      paused: 'Venue frozen. Try again once it is released.',
      unavailable: 'Not sent. Try again.',
    },
  },
  /** League points from a CSV (L-01): member numbers and points, given in one go, all or none. */
  leagueCsv: {
    heading: 'League points from a CSV',
    /** The one hint the file needs: what its columns are. */
    format: 'Two columns: member number, points. A first line of headings is skipped.',
    choose: 'Choose a CSV',
    chooseAnother: 'Choose another CSV',
    summary: '{members} members, {points} points',
    badLine: 'Line {line}: not a member number and 1 to 10,00,000 points.',
    twice: 'Line {line}: member {number} is listed twice.',
    tooMany: 'Over 500 members. Split the file.',
    empty: 'No rows in that file.',
    unreadable: 'Not read. Choose a CSV file.',
    reason: 'Reason',
    give: 'Give League points',
    done: '{points} League points given to {members} members.',
    failures: {
      no_member: 'No member numbered {numbers}. Nothing was given.',
      not_allowed: 'Not in your role. Ask an admin.',
      invalid: '1 to 500 members and a reason of 3 to 200 characters.',
      paused: 'Venue frozen. Try again once it is released.',
      unavailable: 'Not sent. Try again.',
    },
  },
  notAllowed: 'Not in your role. Ask an admin.',
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
  /** A hotel night's price: `2 nights`. */
  nights: '{nights} nights',
  oneNight: '1 night',
  /** The redemptions' price column: points, or nights for a hotel night. */
  priceColumn: 'Price',
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
  detailHint: 'Shown to the member, such as “At the host desk”.',
  invalidDetail: 'Say where to collect it, in up to 200 characters.',
  price: 'Points',
  invalidPrice: 'A whole number of points from 1 to 1,00,00,000.',
  /** A hotel night is priced in nights (#146). */
  priceNights: 'Nights',
  invalidNights: 'A whole number of nights from 1 to 1,000.',
  stock: 'How many are left',
  stockHint: 'Leave blank for no limit.',
  invalidStock: 'A whole number, or blank for no limit.',
  onOffer: 'On offer',
  onOfferHint: 'Members can redeem it.',
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
  /** Cancelling a redemption not yet handed over (#462): what it took goes back to the member. */
  cancelRedemption: 'Cancel',
  cancelRedemptionName: 'Cancel {reward} for {name}',
  cancelRedemptionReason: 'Why {reward} for {name} is cancelled',
  cancelRedemptionConfirm: 'Cancel and give back what it took',
  invalidCancelReason: 'Give a reason of 3 to 300 characters.',
  failures: {
    not_allowed: 'Your role does not allow this.',
    invalid: 'Not saved. Check the values.',
    stock_changed: 'Redeemed while you edited. Open it again.',
    handed_over: 'Already handed over.',
    not_on_offer: 'That reward is not on offer, or none are left.',
    price_changed: 'The price has changed.',
    not_enough_points: 'Not enough points.',
    not_enough_nights: 'Not enough nights.',
    stopped: 'That member is frozen.',
    paused: 'Venue frozen. Try again once it is released.',
    switched_off: 'Redemptions are paused.',
    cancelled: 'Cancelled. The points went back to the member.',
    unavailable: 'Not sent. Try again.',
  },
} as const;

/** The console's League screen: standings by month or season, and the seasons (rewards.manage). */
export const league = {
  title: 'League',
  notAllowed: 'Not in your role. Ask an admin.',
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
  /** Given by hand on Rewards (L-01). */
  byHand: 'By hand',
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
    invalid: 'Overlaps another season, or the months are out of order.',
    paused: 'Venue frozen. Try again once it is released.',
    unavailable: 'Not sent. Try again.',
  },
} as const;

/** A reward's or a dish's photo on the console (AS-11): the club's own, shown in the app in a 4:3 tile. */
export const itemPhoto = {
  /** Read out with the button: `Add a photo of Paneer tikka`. */
  add: 'Add a photo',
  addName: 'Add a photo of {name}',
  replace: 'Replace the photo',
  replaceName: 'Replace the photo of {name}',
  saved: 'Photo saved.',
  failures: {
    not_a_photo: 'Not a photo. Choose a JPEG, PNG or WebP.',
    too_big: 'Too large. Choose a smaller photo.',
    not_allowed: 'Not in your role. Ask an admin.',
    unavailable: 'Not sent. Try again.',
  },
} as const;
