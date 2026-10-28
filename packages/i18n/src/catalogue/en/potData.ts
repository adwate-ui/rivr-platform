/** The console's Pot data screen (#114, decision 0185): every hand by table, dealer, variant and period, for the super admin. */
export const potData = {
  title: 'Hands',
  notAllowed: 'Pot data is for the super admin.',
  /** The period: the club's days from and to, each 06:00 to 06:00 IST. */
  from: 'From',
  to: 'To',
  periodHint: 'Club days, 06:00 to 06:00.',
  invalidPeriod: 'Choose a first day no later than the last.',
  /** The filters: one table, dealer or variant, or all. */
  table: 'Table',
  dealer: 'Dealer',
  variant: 'Variant',
  all: 'All',
  hands: 'Hands',
  noHands: 'No hands in this period.',
  /** Shown when the period holds more hands than the screen reads. */
  tooMany: 'Showing the latest {count} hands. Choose a shorter period to see them all.',
  when: 'When',
  pot: 'Pot',
  rake: 'Rake',
  drop: 'Jackpot drop',
  cap: 'Cap applied',
  capYes: 'Yes',
  capNo: 'No',
  highHand: 'High hand',
  playbackLabel: 'Playback: {table}, {when}',
  noHighHand: 'None',
} as const;
