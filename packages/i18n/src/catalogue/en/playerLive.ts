/**
 * Tonight, as the redesign has it (decision 0320, "Live night"): the member's own state fills the screen, browsing, on a
 * list, called to a seat, or seated, and the floor sits in a sheet.
 */
export const playerLive = {
  title: 'Tonight',
  offers: '{count} offers',
  offersOne: '1 offer',
  /** The referral offer card (it left Home's tables for the carousel): `{chips}` is the bonus, `1,000`. */
  referralTitle: 'Referral',
  referralOffer: '{chips} bonus chips each',
  referralSchedule: 'Every day',
  /** A club notice's card above the offers (decision 0424): its gold eyebrow. */
  notice: 'From the club',
  allTables: 'All tables',
  running: '{count} running',
  runningWithTournaments: '{tables} running · {tournaments} tournaments',
  /** A table's row: `Table 1 · NLH 50/100`. */
  tableName: '{name} · {game}',
  noWait: 'No wait',
  waiting: '{count} waiting',
  closed: 'Closed',
  seatsOpen: '{count} open',
  full: 'Full',
  opensLater: 'Opens later',
  tournaments: 'Tournaments',
  notifyMe: 'Notify me',
  notifying: 'Notifying you',
  games: { nlh: "No-Limit Hold'em", plo: 'Pot-Limit Omaha' },
  join: {
    /** Read out for the seat map: `3 of 9 seats open`. */
    seatMap: '{open} of {seats} seats open',
    seatsOpen: 'Seats open',
    seatsOf: '{open} of {seats}',
    waiting: 'Waiting',
    none: 'None',
    callTime: 'Call time',
    takeSeat: 'Take a seat',
    joinWaitlist: 'Join waitlist',
    paused: 'The club is paused',
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
    leave: 'Leave waitlist',
    joinedToast: 'Joined waitlist',
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
    title: '{table} · Seat {seat}',
    /** Under the seat: `NLH 50/100 · playing 19 min`. */
    playing: '{game} · playing {time}',
    left: 'call time left · ends {time}',
    /** The ring's clock, read out: `Call time left 2h 41m`. */
    timer: 'Call time left {time}',
    seatedToast: 'Seated at {table}, seat {seat}',
  },
  /** What the member does from the seat (brief 3.4 E): three round actions, each a sheet, then food and drink. */
  seat: {
    topUp: 'Top up',
    addTime: 'Add time',
    leave: 'Leave seat',
    requestTopUp: 'Request top-up',
    cancel: 'Cancel',
    /** `{choice}` is `1 hour`. */
    requestTime: 'Request {choice}',
    /** Every length the club may offer (decision 0305); the club's setting picks which show. */
    times: { m15: '15 min', m30: '30 min', m45: '45 min', m60: '1 hour', m90: '1 hour 30', m120: '2 hours', m180: '3 hours', m240: '4 hours' },
    /** Once the floor approves: `1 hour added`. */
    timeAdded: '{choice} added',
    leaveTitle: 'Leave your seat?',
    /** `{time}` is `2h 41m`. */
    leaveLeft: '{time} call time left.',
    joinLeaving: 'Join leaving list',
    stay: 'Stay seated',
    order: 'Order to my seat',
    orderAgain: 'Order again',
    /** The order tracker's steps, read out as a list named this. */
    orderLabel: 'Order',
    stages: { sent: 'Sent', preparing: 'Preparing', on_its_way: 'On its way', delivered: 'Delivered' },
    /** An order's line: `2 × Beer`. */
    many: '{quantity} × {name}',
    statusTopUp: 'Top-up',
    requested: 'Requested',
    inProgress: 'In progress',
    statusTimes: { m15: '+15 min', m30: '+30 min', m45: '+45 min', m60: '+1 h', m90: '+1 h 30', m120: '+2 h', m180: '+3 h', m240: '+4 h' },
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
  back: 'Tonight',
  title: 'Order',
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
} as const;

