/** A promotion in words, for the builder, the approver, the list and the cards saved with a version (audit F-055). */
export const promotionWords = {
  time: { hour: '1 hour', hours: '{count} hours', hoursMinutes: '{hours} h {minutes} min', minutes: '{minutes} min' },
  seat: {
    /**
     * In tiers (decision 0580): `Bonus chips on a first seat, once a member: first 10 get 5,000, next 20 get 2,000`. Five tiers at
     * their longest (10,000 claims at 1,00,00,000 chips) come to 188 characters, inside the card's 200.
     */
    tiers: 'Bonus on a first seat, once a member: {tiers}', tierFirst: 'first {count} get {chips}', tierNext: 'next {count} get {chips}',
    first: '{chips} Bonus on the first seat of a visit', firstN: '{chips} Bonus for the first {count} seated at a table' },
  hoursBonus: {
    after: '{chips} Bonus after {time}', thenAfter: 'then {chips} after {time}', every: '{chips} Bonus every {time}',
    everyHour: '{chips} Bonus every hour', upToOnce: 'up to once a visit', upToTimes: 'up to {count} times a visit',
  },
  bonusChips: {
    visit: '{chips} Bonus on each visit',
    referral: '{chips} Bonus for each referral', signup: '{chips} Bonus on sign-up',
  },
  priority: 'Front of every waitlist',
  /** A text promotion's limits in the one-line summary (#1064). */
  givesNothing: 'Gives nothing',
  /** A high hand bonus by the most it pays (redesign correction 30). */
  highHand: 'Up to {chips} Bonus a hand',
  /** The same promotion in the one-line summary: `Royal flush 25,000, Straight flush 10,000 Bonus, paid each time`. */
  highHandEach: '{hand} {chips}',
  highHandLine: '{hands} Bonus, paid each time',
  allStakes: 'all stakes',
  audience: { new_30d: 'new members, first 30 days', lapsed: 'lapsed regulars' },
  days: { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' },
  everyDay: 'every day',
  window: '{days} {from}–{to}',
  allDay: '{days}, all day',
  fromHour: '{days}, 24 hours from {from}',
  perMember: {
    none: 'No limit per member', per_visit: 'Once per visit per member', per_day: 'Once a day per member',
    per_week: 'Once a week per member', once: 'Once ever per member',
  },
  timesPerMember: {
    per_visit: 'Up to {count} times per visit per member', per_day: 'Up to {count} times a day per member',
    per_week: 'Up to {count} times a week per member', once: 'Up to {count} times ever per member',
  },
  firstMembers: 'first {count} members a day',
  atMost: 'at most {count} times',
  atMostMonth: 'at most {count} times a month',
  budget: 'budget {count} Bonus',
  budgetMonth: 'budget {count} Bonus a month',
  line: '{reward}, for {who}, {when}. {limits}. Starts {starts}, {ends}.',
  noEnd: 'no end date',
  ends: 'ends {date}',
};
