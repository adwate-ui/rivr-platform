/** Feedback (#160, decision 0165): the member's rating and notes in the app, and the General Manager's list on the console. */

/** The console's Feedback screen, for the General Manager (feedback.manage). */
export const feedback = {
  title: 'Feedback',
  notAllowed: 'Your role does not include feedback. Ask an admin if you need it.',
  open: 'Open tickets',
  noneOpen: 'No open tickets.',
  recent: 'The last 90 days',
  noneRecent: 'No feedback in the last 90 days.',
  /** A rating: `{name}` and their number, `{score}` of 5, and the day of the visit (IST): `Mihir Shah · No. 1213 · 2 of 5 · visit 25 Oct`. */
  ratingLine: '{name} · No. {number} · {score} of 5 · visit {date}',
  /** A note sent from Profile, on the day it came. */
  noteLine: '{name} · No. {number} · a note from the app · {date}',
  /** The app's two forms (#637): the quick note with its topic, and the detailed form with its recommendation, 0 to 10. */
  quickLine: '{name} · No. {number} · a quick note on {topic} · {date}',
  detailedLine: '{name} · No. {number} · detailed feedback, would recommend {nps} of 10 · {date}',
  /** The detailed form's ratings, each 1 to 5: `Gameplay 5 · Cashier 3`. */
  rating: '{area} {score}',
  ratingsSeparator: ' · ',
  rated: { gameplay: 'Gameplay', cashier: 'Cashier', service: 'Service', ambience: 'Ambience' },
  topics: {
    gameplay: 'Gameplay', dealer: 'Dealer', check_in_out: 'Check-in and check-out', app: 'The app', service: 'Service', ambience: 'Ambience',
    cashier: 'Cashier',
  },
  /** A resolved ticket: what was done, by whom and when. */
  resolvedLine: 'Resolved by {name} on {date}: {resolution}',
  resolution: 'What was done',
  resolutionHint: 'Kept with the ticket, with your name.',
  invalidResolution: 'Say what was done, in at most 500 characters.',
  resolve: 'Resolve',
  resolveName: 'Resolve {name}’s ticket',
  failures: {
    not_allowed: 'Your role does not allow this.',
    invalid: 'That ticket is resolved already. The list now shows it.',
    already_rated: 'That ticket is resolved already. The list now shows it.',
    too_old: 'That ticket is resolved already. The list now shows it.',
    stopped: 'That member is frozen.',
    paused: 'The venue is frozen. Tickets are resolved again once it is released.',
    unavailable: 'That did not go through. Check the connection and try again.',
  },
} as const;

/** In the player app: Home asks about the last visit, and Profile sends the club a note. */
export const playerFeedback = {
  /** On Home after a visit: `{day}` is the IST weekday, as in "How was Saturday?". */
  prompt: 'How was {day}?',
  promptHint: 'Rate your visit. The General Manager reads every one.',
  score: 'Your rating, 1 to 5',
  /** Each score's chip, for a screen reader: "2 of 5". */
  scoreLabel: '{score} of 5',
  note: 'Anything to add (optional)',
  send: 'Send',
  thanks: 'Thank you. The General Manager reads every one.',
  /** After a score of 3 or below. */
  thanksFollowUp: 'Thank you. The General Manager will look into it and may call you.',
  /** In Profile. */
  title: 'Feedback',
  intro: 'Tell the club what would make your next visit better. The General Manager reads every note.',
  noteLabel: 'Your note',
  invalidNote: 'Write a note of up to 1,000 characters.',
  sent: 'Sent. Thank you.',
  /** The two forms (#637): a quick note on one topic, or the detailed one. */
  form: 'How would you like to tell us?',
  forms: { quick: 'Quick note', detailed: 'Detailed feedback' },
  topic: 'What is it about?',
  topics: {
    gameplay: 'Gameplay', dealer: 'Dealer', check_in_out: 'Check-in and check-out', app: 'The app', service: 'Service', ambience: 'Ambience',
    cashier: 'Cashier',
  },
  chooseTopic: 'Choose what it is about.',
  /** The detailed form's four ratings, 1 to 5. */
  rated: {
    gameplay: 'The gameplay, 1 to 5', cashier: 'The cashier, 1 to 5', service: 'The service, 1 to 5',
    ambience: 'The ambience, 1 to 5',
  },
  rateAll: 'Rate all four, from 1 to 5.',
  /** The NPS question, 0 to 10. */
  nps: 'How likely are you to recommend RIVR to a friend, 0 to 10?',
  chooseNps: 'Choose from 0 to 10.',
  openQuestion: 'Anything else you would like to tell us? (optional)',
  failures: {
    not_allowed: 'This visit cannot be rated from here.',
    invalid: 'Choose a rating from 1 to 5, and keep the note under 1,000 characters.',
    already_rated: 'You have rated this visit already. Thank you.',
    too_old: 'A visit can be rated in the week after it. Use Feedback in Profile instead.',
    stopped: 'Your account is paused. Please speak to the front desk.',
    paused: 'The club is paused. Please try again later.',
    unavailable: 'That did not go through. Check your connection and try again.',
  },
} as const;
