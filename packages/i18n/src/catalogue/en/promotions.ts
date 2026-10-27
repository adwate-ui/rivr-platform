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
  /** Every scheme in the deck, ready to send for approval as it stands (#85, #144). */
  templates: 'Templates',
  submitTemplate: 'Send for approval',
  /** After a template is sent: `{name}` is the template. */
  templateSubmitted: '{name} waits for a super admin.',
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
  submit: 'Submit for approval',
  /** After Submit for approval: `{name}` is the promotion. */
  submitted: '{name} waits for a super admin to approve it.',
  /** Promotions waiting for a super admin (#144): only a super admin approves one, never their own. */
  awaiting: {
    heading: 'Waiting for approval',
    /** Under each: `{name}` submitted it at `{time}`. */
    submittedBy: 'Submitted by {name}, {time}',
    waiting: 'Waiting for a super admin.',
    yours: 'You submitted it, so another super admin approves it.',
    approve: 'Approve',
    refuse: 'Refuse',
    refuseReason: 'Why it is refused',
    refuseHint: 'The one who submitted it reads this.',
    invalidReason: 'Say why, in 3 to 300 characters.',
    /** After Approve or Refuse: `{name}` is the promotion. */
    approved: '{name} is live.',
    refused: '{name} went back to draft.',
    /** What it actually does, in words made from its stored rule: the approver reads these, not only the card words. */
    does: 'What it does',
    unreadable: 'Its rule cannot be read here, so it can only be refused.',
  },
  /** A rule in words (#144): `{when}` is its trigger, `{gives}` what it gives, `{who}` for whom. */
  rule: {
    line: '{when}: {gives}',
    forWhom: 'Who and when: {who}',
    everyone: 'anyone, any time',
    trigger: {
      buy_in: 'On a buy-in', hours_played: 'For hours played', hand_logged: 'When a hand is logged', tournament_entry: 'On a tournament entry',
      referral: 'On a referral', check_in: 'On a check-in', graduation: 'On an Academy graduation', date_window: 'Once each club day in its window',
    },
    gives: {
      bonusAmount: 'a {amount} bonus, ending after {days} days',
      bonusShare: 'a bonus of {percent}% of the buy-in, ending after {days} days',
      bonusShareCapped: 'a bonus of {percent}% of the buy-in, up to {cap}, ending after {days} days',
      points: '{points} points',
      pointsMultiplier: '{multiplier} times the points earned',
      freerollTicket: 'a freeroll ticket to {tournament}',
      cab: 'a cab home',
      prize: '{prize}',
      prizeWorth: '{prize}, worth {value}',
      jackpot: '{amount} from the {pool} jackpot',
      message: 'a message: {text}',
      spin: 'a spin of the wheel',
    },
    pools: { main: 'main', season: 'season', freeroll: 'freeroll' },
    conditions: {
      days: 'on {days}', window: 'from {from} to {until}', firstPerTable: 'the first {count} at each table',
      firstPerDay: 'the first {count} each club day', callTime: 'once call time is complete', minHours: 'after {hours} hours played',
      stakes: 'at {stakes}', tables: 'at {count} chosen tables', tiers: '{count} chosen tiers', newPlayer: 'new players only',
      lapsed: 'players back after {days} days away', minVisits: 'members with {count} visits this month', hands: 'for {hands}',
    },
    hands: { four_of_a_kind: 'four of a kind', straight_flush: 'a straight flush', royal_flush: 'a royal flush', bad_beat: 'a bad beat' },
    noLimit: 'No limit per member',
    limitPerDay: 'At most {limit} per member each club day',
    limitInAll: 'At most {limit} per member in all',
    noBudget: 'No budget: it gives without a cap',
    budgetPaise: 'Budget: {amount}',
    budgetCount: 'Budget: {count} grants',
    budgetBoth: 'Budget: {amount} or {count} grants, whichever comes first',
  },
  /** Promotions a super admin sent back (#144), with why: the one who submitted each reads it here. */
  sentBack: {
    heading: 'Sent back',
    /** `{name}` sent it back at `{time}`, saying `{reason}`. */
    line: '{name}, {time}: {reason}',
    template: 'A template again: send it from Templates once it is right.',
    built: 'Build it again with the changes asked for.',
  },
  /** The simulation before publishing (#144): last week's seven club days replayed with the promotion. */
  simulate: 'Simulate last week',
  simulateFirst: 'Simulate it on last week before submitting it.',
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
    not_allowed: 'Only staff who manage promotions submit one, and only a super admin approves or refuses one.',
    own_promotion: 'You submitted this one, so another super admin approves it.',
    already_decided: 'Another super admin has already decided this one.',
    switched_off: 'Promotions are switched off.',
    paused: 'The club is frozen. Nothing changes until it is released.',
    unavailable: 'That did not go through. Try again.',
  },
} as const;
