/** The console's Dealers screen (#124, decision 0252): the rotation board, and each dealer's time, hands and tip-pool share over a period. */
export const dealers = {
  title: 'Dealers',
  notAllowed: 'The dealers board is for staff who run the floor.',
  /** The rotation board: who deals where, and who rests. */
  board: 'Rotation',
  dealer: 'Dealer',
  table: 'Table',
  since: 'Since',
  time: 'Time',
  status: 'Status',
  due: 'Due for rotation',
  dealing: 'Dealing',
  resting: 'Resting',
  noBoard: 'No dealers on the floor.',
  /** Each dealer over the club's days chosen. */
  period: 'Hours and hands',
  from: 'From',
  to: 'To',
  periodHint: 'Club days, 06:00 to 06:00.',
  invalidPeriod: 'Choose a first day no later than the last.',
  downs: 'Downs',
  dealt: 'Time dealt',
  hands: 'Hands',
  handsPerHour: 'Hands per hour',
  rake: 'Rake logged',
  variance: 'Drop-box variance',
  /** The dealer's share of the tip pool by time dealt, in percent. Tips belong to dealers. */
  tipShare: 'Tip-pool share (%)',
  tipShareHint: 'Tips belong to dealers. The export shares the tip pool by time dealt.',
  percent: '{value}%',
  noNights: 'No downs in this period.',
} as const;
