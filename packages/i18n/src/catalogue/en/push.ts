/** The push notifications the push consumer sends (#139, #338): each kind's title and body. */
export const push = {
  seatReady: {
    title: 'Your seat is ready',
    /** `Table 3, seat 9. Hold until 21:40.` */
    body: '{table}, seat {seat}. Held until {time}.',
    /** The notification's button (decision 0321): opens the app, which tells the floor at once. */
    action: "I'm on my way",
  },
  /** Fifteen minutes or less to run (decision 0320): `Call time ends in 15 min`, `Table 1, seat 4. Ends at 23:18.` */
  callTimeEnding: {
    title: 'Call time ends in {minutes} min',
    body: '{table}, seat {seat}. Ends at {time}.',
    /** Opens Set call time on Home (#1059). */
    action: 'Set call time',
  },
  /** The member's call time has run: they may go (8 Nov audit, F-181). */
  callTimeDone: {
    title: 'Call time done',
    body: 'You may leave any time.',
  },
  sessionReminder: {
    title: 'Session reminder',
    body: 'You have been playing for {hours} hours.',
  },
  /** A tournament the member asked about: the club's one notification of it (redesign RD-26). `{when}` is `Sun 22 Nov, 19:00`. */
  tournamentStarts: {
    title: '{name}',
    body: 'Starts {when}.',
  },
  /** Withdrawn or moved (the owner, 9 Nov). */
  tournamentWithdrawn: {
    title: '{name} will not run',
    body: 'It is withdrawn.',
  },
  tournamentMoved: {
    title: '{name} has moved',
    body: 'It now starts {when}.',
  },
  /** Bonus chips added (decision 0504): `500 bonus chips · Welcome bonus`. */
  bonusCredited: {
    title: 'Bonus added',
    body: '{chips} Bonus · {reason}',
  },
  /** Bonus chips used with the buy-in as the floor seated the member: `1,000 bonus chips with your buy-in at Table 3.` */
  bonusRedeemed: {
    title: 'Bonus used',
    body: '{chips} Bonus with your buy-in at {table}.',
  },
  /**
   * The lock-screen live status in the native app (decision 0323), as the prototype's Lock screen states have it: a line
   * above the figure, the figure (a place in words, or a countdown the phone draws) and one button.
   */
  liveStatus: {
    /** Above the place: `Waitlist · Table 1`, or `Waitlist` when no table was asked for. */
    waitlist: 'Waitlist · {table}',
    waitlistAny: 'Waitlist',
    next: 'Next in line',
    /** `{ordinal}` is `2nd`. */
    place: '{ordinal} in line',
    /** A join the floor has not approved yet. */
    requested: 'Requested',
    heldFor: 'Seat ready · held for',
    callTimeLeft: 'Call time left',
    /** Top right while seated: `Table 1, seat 4`. */
    seat: '{table}, seat {seat}',
    onMyWay: "I'm on my way",
    order: 'Order',
  },
} as const;
