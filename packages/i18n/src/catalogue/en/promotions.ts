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
  /** Every scheme in the deck, ready to publish as it stands (#85). */
  templates: 'Templates',
  publishTemplate: 'Publish template',
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
  /** The 10% buy-in bonus's cap, which the floor sets (question #415). */
  bonusCap: 'Most per buy-in, in rupees',
  /** What the bonus gives, on its card: "Up to ₹5,000 a buy-in". */
  bonusDetail: 'Up to {cap} a buy-in',
  limitOptions: { none: 'None', first_50: 'First 50 members a day', once_per_member: 'Once per member' },
  playerApp: 'Player app',
  tvSlide: 'TV slide',
  /** Above the title on the TV slide. */
  slideLabel: 'Promotion',
  publish: 'Publish',
  /** After Publish: `{name}` is the promotion. */
  published: '{name} is live.',
  /** The simulation before publishing (#144): last week's seven club days replayed with the promotion. */
  simulate: 'Simulate last week',
  simulateFirst: 'Simulate it on last week before publishing.',
  simulation: {
    heading: 'Last week',
    /** The club days replayed: "12 Oct to 18 Oct". */
    period: '{from} to {to}',
    replaying: 'Replaying last week.',
    replayed: 'Buy-ins and visits replayed',
    grants: 'Times given',
    members: 'Members',
    cost: 'Bonus cost',
    points: 'Extra points',
    budget: 'Budget',
    noCap: 'No cap',
    budgetLeft: 'Left of the budget',
    budgetReached: 'The budget would have run out.',
    nothing: 'Nothing last week would have earned it.',
    failures: {
      not_allowed: 'Only staff who manage promotions simulate one.',
      not_replayable: 'This promotion cannot be replayed on last week.',
      unavailable: 'The simulation did not run. Try again.',
    },
  },
  failures: {
    invalid: 'Choose both times, the start before the end, within the night (it ends at 06:00).',
    invalidCap: 'The most per buy-in is whole rupees in ₹50 chips, from ₹50 to ₹1,00,000.',
    not_allowed: 'Only staff who manage promotions publish one.',
    switched_off: 'Promotions are switched off.',
    paused: 'The club is frozen. Nothing changes until it is released.',
    unavailable: 'That did not go through. Try again.',
  },
} as const;
