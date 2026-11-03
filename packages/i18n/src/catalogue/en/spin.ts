/** The console's spin wheel (#150; decision 0266), a tab of Rewards (console v3): the spins waiting, and the wheel's prizes and odds. */
export const spin = {
  title: 'Spin wheel',
  notAllowed: 'Not in your role. Ask an admin.',
  waiting: 'Spins waiting',
  noneWaiting: 'No spins waiting.',
  member: 'Member',
  promotion: 'Promotion',
  granted: 'Given',
  spin: 'Spin',
  spinFor: 'Spin for {name}',
  won: '{name} won {prize}.',
  wheel: 'The wheel',
  noPrizes: 'No prizes on the wheel yet.',
  /** Above the waiting spins while no prize can be drawn: Spin waits for one (C-08). */
  noDrawable: 'The wheel has no prize to draw. Add one, then spin.',
  prize: 'Prize',
  odds: 'Odds',
  /** The odds in words, `3 in 10`, a prize's weight out of the weights of all prizes that can be won now; `Off` off the wheel. */
  chance: 'Chance',
  oddsValue: '{weight} in {odds}',
  offWheel: 'Off',
  /** A bonus more than what is left of this month's spin budget is off the wheel, here and on the TVs. */
  budgetSpent: 'Off the wheel: this month’s spin budget cannot pay it',
  /** Where that budget is set: Settings, Members and rewards. */
  budgetLink: 'Spin budget',
  remove: 'Remove',
  removeName: 'Remove {prize}',
  confirmRemove: 'Yes, remove {prize}',
  kind: 'Prize',
  kinds: { points: 'Points', bonus: 'Bonus', nothing: 'Nothing' },
  points: 'Points',
  bonus: 'Bonus chips, in 50s',
  /** The weight's field, its label shown inside it until something is typed. */
  weight: 'Weight 1 to 1,000',
  weightHint: 'Weight 2 comes up twice as often as 1.',
  add: 'Add to the wheel',
  added: '{prize} is on the wheel.',
  /** A prize as the console names it; a bonus as bonus chips, never rupees (#629). */
  prizes: { points: '{points} points', bonus: '{chips} bonus chips', nothing: 'Nothing' },
  failures: {
    not_allowed: 'Not in your role. Ask an admin.',
    invalid: 'Whole points, chips in 50s, weight 1 to 1,000.',
    gone: 'Already spun, or the prize is gone.',
    no_prize: 'No prize fits the budget. Add points or nothing, or raise a budget.',
    paused: 'Paused. Spin when it reopens.',
    unavailable: 'Not sent. Try again.',
  },
} as const;
