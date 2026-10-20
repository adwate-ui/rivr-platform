/** The console's Promotions (#84; design prompt Promotions, flow 7): what is running, and the builder's four blocks. */
export const promotions = {
  title: 'Promotions',
  notAllowed: 'Only staff who manage promotions see this.',
  running: 'Running',
  empty: 'No promotions running.',
  live: 'Live',
  paused: 'Paused',
  pause: 'Pause',
  resume: 'Resume',
  newPromotion: 'New promotion',
  when: 'When',
  days: 'Days',
  from: 'From',
  to: 'To',
  who: 'Who',
  reward: 'Reward',
  limits: 'Limits',
  allStakes: 'All stakes',
  everyDay: 'Every day',
  /** By ISO day: Monday is day 1. */
  dayNames: { monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday', thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday' },
  /** A window on the chosen days, in IST: "Thursday, 14:00 to 20:00". */
  dayWindow: '{days}, {from} to {until}',
  /** Who and when, under the title on the cards: "100/200 · Thursday, 14:00 to 20:00". */
  runs: '{who} · {when}',
  /** With a limit, which players must know: "NLH 100/200 · Thursday, 14:00 to 20:00 · Once per member". */
  runsWithLimit: '{who} · {when} · {limit}',
  rewards: { double_points: 'Double points', triple_points: 'Triple points', buy_in_bonus: '10% buy-in bonus' },
  limitOptions: { none: 'None', first_50: 'First 50 members a day', once_per_member: 'Once per member' },
  playerApp: 'Player app',
  tvSlide: 'TV slide',
  /** Above the title on the TV slide. */
  slideLabel: 'Promotion',
  publish: 'Publish',
  /** After Publish: `{name}` is the promotion. */
  published: '{name} is live.',
  failures: {
    invalid: 'Choose both times, the start before the end, within the night (it ends at 06:00).',
    not_allowed: 'Only staff who manage promotions publish one.',
    switched_off: 'Promotions are switched off.',
    paused: 'The club is frozen. Nothing changes until it is released.',
    unavailable: 'That did not go through. Try again.',
  },
} as const;
