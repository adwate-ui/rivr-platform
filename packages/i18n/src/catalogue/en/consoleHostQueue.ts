/** The console's host queue (#165): lapsed regulars to call, why they stopped coming, and the offer made. */
export const consoleHostQueue = {
  title: 'Host queue',
  hint: 'Regulars who have stopped coming, longest gone first. Call each, note why, and make an offer.',
  notAllowed: 'Only staff who manage members can use the host queue.',
  none: 'No lapsed regulars to call.',
  /** `+91 90000 00642 · last here 28 Sep 2026 · 4 visits before that` */
  lapse: '{phone} · last here {last} · {visits} visits before that',
  offered: 'Offered: {offer}',
  reasonFor: 'Why {name} stopped coming',
  offerTo: 'Offer to {name}',
  note: 'Note on {name}',
  save: 'Save the call to {name}',
  close: 'Close {name}',
  reasons: {
    moved_away: 'Moved away', busy: 'Busy', budget: 'Budget', game_too_big: 'Game too big', game_too_small: 'Game too small',
    bad_experience: 'Unhappy with a visit', playing_elsewhere: 'Playing elsewhere', unreachable: 'Could not reach', other: 'Other',
  },
  kinds: { none: 'No offer', points: 'Points', bonus: 'Bonus', spin: 'A free spin', message: 'A message' },
  values: { points: 'Points for {name}', bonus: 'Bonus for {name}, in rupees', message: 'Message to {name}' },
  /** Why an offer cannot be saved yet, under its field. */
  invalid: { points: 'Type a whole number of points.', bonus: 'Type a bonus in whole ₹50 chips, such as 2000.', message: 'Type a message of up to 500 characters.' },
  offer: { points: '{points} points', bonus: '{amount} bonus', spin: 'a free spin', message: 'a message', other: 'an offer' },
  failures: {
    not_allowed: 'Only staff who manage members can do this.',
    gone: 'This player has left the queue.',
    paused: 'The venue is frozen. Try again once it is released.',
    unavailable: 'Not saved. Try again.',
  },
} as const;
