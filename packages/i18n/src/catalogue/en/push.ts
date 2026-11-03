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
    action: 'Add time',
  },
  callTimeDone: {
    title: 'Call time complete',
    body: 'Your call time is complete.',
  },
  sessionReminder: {
    title: 'Session reminder',
    body: 'You have been playing for {hours} hours.',
  },
  withdrawalSent: {
    title: 'Withdrawal sent',
    body: '{amount} is on its way to you.',
  },
  tournamentStarting: {
    title: '{name} is starting',
    body: 'The clock has started. Take your seat.',
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
    /** Top right while seated: `Table 1 · Seat 4`. */
    seat: '{table} · Seat {seat}',
    onMyWay: "I'm on my way",
    order: 'Order',
  },
} as const;
