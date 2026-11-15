import { promotionWords } from './promotionWords.ts';

/**
 * The console's Promotions (console v3, phase 7; decisions 0471 and 0491 to 0496): the list by status, the builder in
 * five sections with its summary column, and the approver's view of a waiting version. Bonus and perks,
 * never rupees (decision 0284).
 */
export const promotions = {
  title: 'Promotions',
  notAllowed: 'Not in your role. Ask an admin.',
  newPromotion: 'New promotion',
  allPromotions: 'All promotions',
  /** Above the title on the TV slide preview, as the TV says it. */
  slideLabel: 'Offer',
  /** A promotion in words, for the builder, the approver, the list and the cards saved with a version (audit F-055). */
  words: promotionWords,
  statuses: { draft: 'Draft', awaiting_approval: 'Awaiting approval', scheduled: 'Scheduled', live: 'Live', paused: 'Paused', ended: 'Ended' },
  list: {
    label: 'Promotions',
    /** The Ended tab's table, which keeps a view of its own in the address (owner, 9 Nov). */
    endedLabel: 'Ended promotions',
    filter: 'Show',
    all: 'All',
    empty: 'No promotions with this status.',
    /** Current promotions and ended ones, apart under two tabs (owner, 8 Nov), each with how many. */
    tabs: { current: 'Current {count}', ended: 'Ended {count}', bonus: 'Bonus to approve {count}' },
    noneEnded: 'No promotion has ended.',
    columns: { promotion: 'Promotion', who: 'Who', when: 'When', given: 'Given this week', status: 'Status', ended: 'Ended' },
    /** Under a running promotion's status: its next version, beside it. */
    newVersionWaits: 'New version awaits approval',
    newVersionDraft: 'New version in draft',
    sentBack: 'Sent back',
    /** Under a live promotion that has given nothing for a week (audit F-104). */
    quiet: 'Nothing given in 7 days',
    /** In the Given this week column: what went out, how many times, and the budget used so far. */
    givenOnce: 'Once',
    givenTimes: '{count} times',
    givenChips: '{count} Bonus',
    /** A high hand's count: hands paid (redesign RD-23). */
    handOnce: '1 hand',
    handTimes: '{count} hands',
    budgetUsed: '{used} of {budget} budget',
    budgetUsedMonth: '{used} of {budget} budget this month',
    /** A promotion still run by its old rule (decision 0491): its words and Pause only. */
    byRule: 'Run by its rule',
    pause: 'Pause',
    resume: 'Resume',
    edit: 'Edit',
    review: 'Review',
    pauseNamed: 'Pause {name}',
    resumeNamed: 'Resume {name}',
    editNamed: 'Edit {name}',
    reviewNamed: 'Review {name}',
    /** Ends a scheduled, live or paused promotion for good, after a second press. */
    end: 'End',
    endNamed: 'End {name}',
    confirmEnd: 'Yes, end {name}',
  },
  /** What a staff member's own action did: `{name}` is the promotion, `{date}` its first day. */
  toast: {
    paused: '{name} paused',
    resumed: '{name} resumed',
    ended: '{name} ended',
    saved: '{name} saved as a draft',
    submitted: '{name} sent for approval',
    live: '{name} is live',
    scheduled: '{name} starts {date}',
    sentBack: '{name} sent back to draft',
  },
  /** Bonus a promotion calculated, waiting for a super admin (decision 0670): the Promotions tab of super admins. */
  approvals: {
    label: 'Bonus to approve',
    search: 'Member or promotion',
    empty: 'Nothing waits for approval.',
    columns: { member: 'Member', promotion: 'Promotion', amount: 'Bonus', why: 'Why', when: 'When', decide: 'Decide' },
    /** The member, as the queue names them: `Ishaan Verma · No. 7`. */
    member: '{name} · No. {number}',
    /** What set the Bonus off. A seat names its table; play time, the step reached: `4 h played`. */
    why: {
      signup: 'Sign-up', referral: 'Referral', check_in: 'Visit', seated: 'Seat', seatedAt: 'Seat at {table}', hours_step: 'Play time',
      hoursStep: '{time} played', hours_played: 'Hours played', other: 'Promotion',
    },
    approve: 'Approve',
    approveNamed: 'Approve {amount} Bonus for {name}',
    refuse: 'Refuse',
    refuseNamed: 'Refuse {amount} Bonus for {name}',
    /** Approves every row of the page on screen. */
    approveShown: 'Approve all shown',
    /** The panel that refuses the chosen, with one reason. */
    refuseTitle: 'Refuse {count}',
    reason: 'Why it is refused',
    reasonHint: 'Kept on the record. The member is not told.',
    invalidReason: 'Write a reason of 3 to 200 characters.',
    cancel: 'Cancel',
    /** What a decision did, from the server's count. */
    approved: '{count} approved · {amount} Bonus',
    refused: '{count} refused',
    alreadyDecided: 'Already decided by another super admin.',
    failures: {
      not_allowed: 'Only a super admin approves Bonus.',
      own_record: 'Not your own Bonus. Ask another super admin.',
      invalid: 'Choose at least one, and give a reason to refuse.',
      paused: 'Venue frozen. Try again once it is released.',
      switched_off: 'Promotions are switched off.',
      member_frozen: 'A member chosen is frozen. Leave them out.',
      unavailable: 'Not saved. Try again.',
    },
  },
  builder: {
    newTitle: 'New promotion',
    editTitle: 'Edit: {name}',
    /** Editing a running promotion: `{current}` runs on while `{next}`, its new version, waits. */
    editsLive: 'Changes make version {next}. Version {current} runs until it is approved.',
    /** A draft a super admin sent back: who and why. */
    sentBack: 'Sent back by {name}: {reason}',
    startFrom: 'Start from',
    name: 'Name members see',
    sections: { reward: '1 · Reward', who: '2 · Who qualifies', when: '3 · When', limits: '4 · Limits', where: '5 · Where it shows' },
    rewardKind: 'Reward',
    /** The templates that prefill the builder, and the names they give. */
    templates: {
      blank: 'Blank', seat_bonus: 'Seat bonus', four_hour_bonus: 'Four-hour bonus',
      founders_priority: 'Founders’ Circle priority', high_hand: 'High hand bonus',
    },
    templateNames: {
      seat_bonus: 'Tuesday seat bonus', four_hour_bonus: 'Four-hour bonus',
      founders_priority: 'Founders’ Circle priority', high_hand: 'High hand bonus',
    },
    rewards: {
      seat_bonus: { label: 'First seat', description: 'Fixed Bonus on a first seat' },
      hours_bonus: { label: 'Hours played', description: 'Bonus after time at the tables' },
      bonus_chips: { label: 'Visit or referral', description: 'Fixed Bonus on a visit or referral' },
      waitlist_priority: { label: 'Waitlist priority', description: 'Front of every waitlist' },
      high_hand: { label: 'High hand', description: 'A bonus for each listed hand' },
    },
    fields: {
      chips: 'Amount',
      chipsSuffix: 'Bonus',
      firstN: 'On the first',
      firstNSuffix: 'seats at each table',
      /** A seat bonus of one amount or in tiers (decision 0580); `{tier}` is a tier's number, from 1. */
      seatMode: 'Pays',
      seatFixed: 'One amount',
      seatTiers: 'In tiers',
      tierCount: 'Tier {tier}: the next',
      tierCountFirst: 'Tier 1: the first',
      tierCountSuffix: 'members',
      tierChips: 'Tier {tier} Bonus',
      addTier: 'Add a tier',
      removeTier: 'Remove tier {tier}',
      tiersOnce: 'Each member gets it once, on a first seat. Nothing after the last tier.',
      afterHours: 'After',
      afterSuffix: 'hours played',
      /** A play-time bonus pays at set times or every so often (owner, 8 Nov); `{step}` is a step's number, from 2. */
      hoursMode: 'Pays',
      hoursSteps: 'At set times',
      hoursEvery: 'Every few hours',
      stepChips: 'Then Bonus',
      addStep: 'Add a step',
      removeStep: 'Remove step {step}',
      /** Under a play-time bonus's steps: each keeps its place across versions (the owner, 9 Nov: "Lock step count"). */
      stepsKeepPlace: 'Steps keep their place: add or remove them at the end. To reorder, end this promotion and start a new one.',
      everyHours: 'Every',
      timesPerVisit: 'Times a visit',
      noCap: 'No cap',
      givenOn: 'Given on',
      bonusOn: { visit: 'Each visit', referral: 'Referral', signup: 'Sign-up' },
      /** A high hand (redesign RD-23): each listed hand's Bonus, the hands still to add, and the three rules. */
      bonusSuffix: 'Bonus',
      /** Beside a hand; `removeHand` names it for a screen reader. */
      remove: 'Remove',
      removeHand: 'Remove {hand}',
      addHand: 'Add a hand',
      bothHoleCards: 'Both hole cards must play',
      shownAtShowdown: 'Shown at showdown',
      minPlayers: 'Players dealt in, at least',
      minPlayersSuffix: 'players',
      budget: 'Budget',
      stakes: 'Stakes',
      allStakes: 'All stakes',
      tiers: 'Tiers',
      allTiers: 'All tiers',
      audience: 'Members',
      audiences: { everyone: 'Everyone', new_30d: 'New members, first 30 days', lapsed: 'Lapsed regulars' },
      days: 'Days',
      dayNames: { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' },
      everyDay: 'Every day',
      from: 'From',
      to: 'To',
      timePlaceholder: '20:00',
      startsOn: 'Starts',
      endsOn: 'Ends (blank for no end)',
      perMember: 'Each member',
      perMemberChoices: { none: 'No limit', per_visit: 'Once per visit', per_day: 'Once a day', per_week: 'Once a week', once: 'Once ever' },
      /** Up to how many times a member in the period (decision 0499); blank reads as once. */
      timesPerMember: 'Up to how many times',
      once: 'Once',
      maxMembersPerDay: 'Most members a day',
      budgetChips: 'Budget in Bonus',
      /** Whether the budget and the most grants are for the whole promotion or start again each month. */
      budgetPeriod: 'Budget runs',
      budgetPeriods: { whole: 'For the whole promotion', month: 'Each month' },
      noLimit: 'No limit',
      channels: 'Shows on',
      channelNames: { playerApp: 'Player app', tv: 'TVs', website: 'Website', whatsapp: 'WhatsApp message' },
      rulesText: 'Rules on the website, one a line',
      link: 'Card link (optional)',
    },
    /** Under a field the terms cannot take, after Save draft, Simulate or Submit. */
    errors: {
      name: 'Name it in 3 to 80 characters.',
      chips: 'Whole 50s, from 50.',
      tierList: 'Each tier: 1 to 10,000 members and whole 50s. 1 to 5 tiers.',
      firstN: '1 to 100, or blank for a visit’s first seat.',
      afterHours: 'Half hours, from 0.5 to 24.',
      everyHours: 'Half hours, from 0.5 to 12.',
      timesPerVisit: 'A whole number from 1 to 20, or blank for no cap.',
      steps: 'Each step later than the one before, in half hours to 24, with whole 50s.',
      hands: 'Each hand needs its bonus, in whole 50s.',
      minPlayers: 'A whole number from 2 to 10.',
      budgetNeeded: 'A high hand needs a budget, in whole 50s.',
      who: 'Pick who qualifies again.',
      days: 'Pick at least one day.',
      from: '24-hour time, such as 20:00.',
      to: '24-hour time, such as 02:00.',
      startsOn: 'Pick the first day.',
      endsOn: 'On or after the first day, or blank.',
      timesPerMember: 'A whole number from 2 to 20, or blank for once.',
      maxMembersPerDay: 'A whole number from 1, or blank.',
      budgetChips: 'Whole 50s, or blank.',
      rulesText: 'At most 12 lines of 200 characters.',
      link: 'An https address, or blank.',
    },
    fixFields: 'Not saved. Check the fields marked.',
    inOneLine: 'In one line',
    incomplete: 'Fill in the fields marked to read it here.',
    tvSlide: 'TV slide',
    saveDraft: 'Save draft',
    submit: 'Submit for approval',
  },
  /** Last week replayed on the terms as they stand (decision 0471): submitting waits for it. */
  simulation: {
    heading: 'Last week, if it had run',
    simulate: 'Simulate',
    again: 'Run again',
    hint: 'Run it before submitting, so the approver sees what it gives.',
    /** The club days replayed: "27 Oct to 2 Nov". */
    period: '{from} to {to}',
    membersQualified: 'members qualified',
    timesGiven: 'times given',
    measures: { chips: 'Bonus', perks: 'perks' },
    budgetReached: 'The budget would have run out.',
    /** The approver's view replays last week afresh (decision 0495). */
    replaying: 'Replaying last week.',
    failed: 'Not loaded. Try again.',
  },
  /** The approver's view of a waiting version against the running one (four eyes, decision 0471). */
  review: {
    title: 'Review: {name}',
    /** `{version}` waits; `{name}` submitted it at `{time}`. */
    submittedBy: 'Version {version}, submitted by {name}, {time}.',
    /** A version with no submitter of its own, converted from a rule (decision 0491). */
    waitingVersion: 'Version {version} awaits approval.',
    newPromotion: 'A new promotion. Nothing runs yet.',
    /** What the waiting version changes against the running one, `{parts}` named in order. */
    changes: 'Changes from version {version}: {parts}.',
    noChanges: 'The same terms as version {version}.',
    parts: {
      name: 'name', reward: 'reward', eligibility: 'who qualifies', schedule: 'when', limits: 'limits', channels: 'where it shows', rulesText: 'rules',
      link: 'card link',
    },
    /** The running version's one line, for the approver to read beside the new one. */
    runningNow: 'Version {version} now',
    changed: 'Changed',
    approve: 'Approve',
    reject: 'Reject',
    rejectReason: 'Why it goes back',
    /** The rule, shown before the reason is sent. */
    rejectHint: '3 to 300 characters. The author reads it.',
    invalidReason: 'Say why, in 3 to 300 characters.',
    sendBack: 'Send back',
    yours: 'You submitted or changed this version, so another super admin approves it.',
    notApprover: 'A super admin approves it.',
    unreadable: 'Its terms cannot be read here. Send it back.',
  },
  /** A high hand promotion's record, beside the list (redesign RD-23). `{hand}` is the hit named exactly. */
  record: {
    tabs: { paid: 'Paid tonight', terms: 'Hands and rules' },
    handsTonight: 'Hands paid tonight',
    bonusTonight: 'Bonus paid tonight',
    thisWeek: 'This week',
    budgetLeft: 'Budget left',
    budgetLeftMonth: 'Budget left this month',
    log: 'Log a high hand',
    none: 'No high hand paid tonight.',
    hit: '{hand} · {table}, seat {seat}',
    paid: '+{chips}',
    bonusForEachHand: 'Bonus for each hand',
    change: 'Change hands and rules',
    rules: 'Rules',
    yes: 'Yes',
    no: 'No',
    playersDealt: 'Players dealt in',
    orMore: '{count} or more',
    where: 'Where',
  },
  /** A promotion opened by its address that the builder cannot show. */
  open: {
    legacy: 'This promotion runs by its rule. Pause or resume it from the list.',
  },
  /** Why a call did not go through, from @rivr/db's PromotionVersionFailure. */
  failures: {
    not_allowed: 'Not in your role. Ask an admin.',
    invalid: 'Not saved. Check the fields marked.',
    needs_simulation: 'Not sent. Simulate it on last week first.',
    own_promotion: 'Not approved. Another super admin approves your version.',
    already_decided: 'Already decided. Reload the list.',
    tiers_fixed: 'Not saved. To pay in tiers, or to stop paying in tiers, end this promotion and start a new one.',
    another_high_hand: 'Another high hand promotion is running. End it first.',
    switched_off: 'Promotions are switched off.',
    paused: 'Venue frozen. Try again once it is released.',
    not_found: 'Promotion not found. Reload the list.',
    unavailable: 'Not sent. Try again.',
  },
} as const;
