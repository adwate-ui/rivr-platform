/**
 * Home (Tonight until the owner renamed it, 8 Nov), as the redesign has it (decision 0320, "Live night"): the member's own
 * state fills the screen, browsing, on a list, called to a seat, or seated, and the floor sits in a sheet.
 */
export const playerLive = {
  title: 'Home',
  /** The offers carousel's name, read out; it has no heading (redesign RD-20). */
  offersTitle: 'Offers',
  /** The referral offer's card, only while a referral promotion is live: `{chips}` is the Bonus, `1,000`. */
  referralTitle: 'Refer a friend',
  referralOffer: '{chips} Bonus each',
  referralLine: 'When a friend joins and takes a first seat',
  /** The high hand's offer card (redesign RD-25): its eyebrow, and a hand with its Bonus, `Royal flush 25,000`. */
  highHandTitle: 'High hand bonus',
  highHandEach: '{hand} {chips}',
  /** A club notice's card above the offers (decision 0424): its gold eyebrow. */
  notice: 'From the club',
  allTables: 'All tables',
  running: '{count} running',
  runningWithTournaments: '{tables} running · {tournaments} tournaments',
  /** A table's row: `Table 1 · NLH 50/100`, with a straddle `Table 5 · NLH 100/200/400` (owner, 8 Nov). */
  tableName: '{name} · {game}',
  /** The game before its stakes in a table's row. */
  gameShort: { nlh: 'NLH', plo: 'PLO' },
  noWait: 'No wait',
  waiting: '{count} waiting',
  closed: 'Closed',
  /** Under a table's name (owner, 8 Nov: the buy-in, never how many seats are open): `Min buy-in ₹5,000`. */
  minBuyIn: 'Min buy-in {amount}',
  full: 'Full',
  opensLater: 'Opens later',
  tournaments: 'Tournaments',
  notifyMe: 'Notify me',
  notifying: 'Notifying you',
  /** The same pills' full names for a screen reader: `Notify me: RIVR Sunday`. */
  notifyMeName: 'Notify me: {name}',
  notifyingName: 'Notifying you: {name}',
  games: { nlh: "No-Limit Hold'em", plo: 'Pot-Limit Omaha' },
  join: {
    minBuyIn: 'Min buy-in',
    /** The join's one button: a request the floor approves onto the table's list; players see no wait (owner, 8 Nov). */
    request: 'Request a seat',
    callTime: 'Call time',
  },
  list: {
    /** Above the place: `Waitlist · Table 1 · NLH 50/100`. */
    eyebrow: 'Waitlist · {table} · {game}',
    next: 'Next in line',
    /** `{ordinal}` is `2nd`. */
    place: '{ordinal} in line',
    /** A join the floor has not approved yet: no number until it does. */
    requested: 'Requested',
    joined: 'Joined {time}',
    /** How the member hears their seat is ready: the floor's Call (owner, 8 Nov), by the app, as production has no WhatsApp (decision 0697). */
    called: 'The floor calls you here when your seat is ready.',
    leave: 'Leave waitlist',
    /** A member let in by their selfie, waiting before the desk has checked them (decision 0503). */
    deskFirst: 'Your ID is checked at the desk before you sit.',
    /** The toast after Request a seat, which the floor still approves (8 Nov audit, F-047). */
    joinedToast: 'Seat requested',
    leftToast: 'Left waitlist',
  },
  ready: {
    eyebrow: 'Your seat is ready',
    title: '{table}, seat {seat}',
    heldUntil: 'Held until {time}',
    /** The hold's countdown, read out: `Seat held for 19 min`. */
    timer: 'Seat held for {minutes} min',
    onMyWay: "I'm on my way",
    telling: 'Telling the floor',
    decline: 'Decline seat',
    declinedToast: 'Seat declined',
  },
  seated: {
    /** `Table 3, seat 4`, as the seated toast and the push say it. */
    title: '{table}, seat {seat}',
    /** Under the seat: `NLH 50/100 · playing 19 min`. */
    playing: '{game} · playing {time}',
    /** Where the call-time ring was (the owner, 17 Nov): `Playing since` over `21:40`. */
    playingSince: 'Playing since',
    /** Under it, once the member has set their call time (#1059): `Call time until 00:10`. */
    callTimeUntil: 'Call time until {time}',
    /** The next play-time bonus on this seat (audit F-173). */
    nextBonus: 'Next: {chips} Bonus',
    nextBonusIn: 'in {time}',
    seatedToast: 'Seated at {table}, seat {seat}',
  },
  /** What the member does from the seat (brief 3.4 E): three round actions, each a sheet, then food and drink. */
  seat: {
    topUp: 'Top up',
    /** The member sets their call time from now, a length the club offers, with no floor approval (#1059). */
    setCallTime: 'Set call time',
    /** Once set, a length extends it (#1076). */
    extendCallTime: 'Extend call time',
    /** Under Extend's lengths (#1089, the owner, 19 Nov). */
    extendNote: 'Extend adds time beyond the current end.',
    leave: 'Leave seat',
    requestTopUp: 'Request top-up',
    cancel: 'Cancel',
    /** Under the lengths: when the one chosen ends, `Until 00:10`. */
    callTimeEnds: 'Until {time}',
    /** Under lengths greyed out because they end before the call time owed: `Can't end before 23:40.` */
    callTimeNotBefore: "Can't end before {time}.",
    /** Under Extend's lengths closed because they would take the call time past its most (1,440 minutes, #1099). */
    extendPastMost: "Call time can't pass 24 hours.",
    /** Set or extended: the seat then says until when. */
    callTimeSet: 'Call time set',
    callTimeExtended: 'Call time extended',
    leaveTitle: 'Leave your seat?',
    /** `{time}` is `2h 41m`. */
    leaveLeft: '{time} call time left.',
    /** Owed with no call time set, once the countdown is done (#1076). */
    leaveNotSet: 'Call time not set.',
    joinLeaving: 'Join leaving list',
    stay: 'Stay seated',
    order: 'Order to my seat',
    orderAgain: 'Order again',
    /** While the bar has not accepted the order (F-048). */
    cancelOrder: 'Cancel order',
    cancelOrderConfirm: 'Yes, cancel it',
    cancelToast: 'Order cancelled',
    cancelFailures: { accepted: 'The bar has started it.', unavailable: 'Not sent. Try again.' },
    /** The order tracker's steps, read out as a list named this. */
    orderLabel: 'Order',
    stages: { sent: 'Sent', preparing: 'Preparing', on_its_way: 'On its way', delivered: 'Delivered' },
    /** An order's line: `2 × Beer`. */
    many: '{quantity} × {name}',
    statusTopUp: 'Top-up',
    requested: 'Requested',
    inProgress: 'In progress',
    statusLeaving: 'Leaving list',
    onTheList: 'On the list',
    /** A seated member's place on another list to change tables (#781), with no table asked for: `Waitlist · NLH 100/200`. */
    statusWaitlist: 'Waitlist · {game}',
  },
  rate: {
    /** `Tonight · 2h 41m at Table 1`, or for a visit on an earlier night `14 Nov · 2h 41m at Table 1`. */
    eyebrow: '{when} · {duration} at {table}',
    /** The visit's night when it is tonight's; a visit with no table played says only this, or its date. */
    tonight: 'Tonight',
    title: 'How was your night?',
    poor: 'Poor',
    excellent: 'Excellent',
    note: 'Anything to add? (optional)',
    send: 'Send to the General Manager',
    sentToast: 'Rating sent',
  },
} as const;

/** The Order screen (brief 3.5): food and drink to the seat, paid on delivery. */
export const playerOrder = {
  back: 'Home',
  title: 'Order',
  /** A super admin switched food and drink off (decision 0681): an order already placed is still served. */
  off: 'Food and drink is not being served.',
  /** `Table 1, seat 4 · Pay on delivery`. */
  seat: '{table}, seat {seat} · Pay on delivery',
  categories: 'Menu',
  usual: 'Your usual',
  addBoth: 'Add both',
  add: 'Add',
  /** Read out for an item's Add: `Add Masala chai`. */
  addName: 'Add {name}',
  send: 'Send to the bar',
  items: '{count} items',
  itemsOne: '1 item',
  sentToast: 'Order sent',
  /** What to ask of the bar with an order (F-052), the list private.fnb_bar_note holds. */
  barNote: 'Note for the bar',
  barNotes: { no_ice: 'No ice', less_sugar: 'Less sugar', less_spicy: 'Less spicy', no_onion: 'No onion', no_garlic: 'No garlic' },
} as const;

