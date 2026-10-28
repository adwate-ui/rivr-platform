/** The push notifications the push consumer sends (#139, #338): each kind's title and body. */
export const push = {
  seatReady: {
    title: 'Your seat is ready',
    /** `Table 3, seat 9. Hold until 21:40.` */
    body: '{table}, seat {seat}. Hold until {time}.',
  },
  callTimeDone: {
    title: 'Call time done',
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
