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
} as const;
