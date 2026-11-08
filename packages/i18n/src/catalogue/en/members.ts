import { memberBonus } from './memberBonus.ts';
import { memberSignUp } from './memberSignUp.ts';

/** The console's Members screen (#60): find a member, open their record, and change their tier. */
export const members = {
  title: 'Members',
  notAllowed: 'Not in your role. Ask an admin.',
  /** Every member is listed on open (decision 0483); a tier (additions flow 20) and the search narrow the list. */
  filterTier: 'Tier',
  anyTier: 'All tiers',
  noneInTier: 'No members in {tier}.',
  none: 'No members yet.',
  /** How an export of the list records the search (#102), and what it records when nothing narrows the list. */
  searchedFor: 'Search: {query}',
  allMembers: 'All members',
  /** The search field's label, shown inside it (console v3): a name as typed, a member number, or four or more digits. */
  search: 'Name, member no. or mobile',
  /** `{query}` is what was typed. */
  noMatch: 'No member matches {query}.',
  number: 'No.',
  name: 'Name',
  tier: 'Tier',
  visits: 'Visits',
  /** More of each member on the list (owner, 8 Nov): their mobile (super admins only), KYC, time played, city and joining day. */
  mobile: 'Mobile',
  kyc: 'KYC',
  kycStatuses: { verified: 'Verified', in_review: 'In review', at_desk: 'Desk check', refused: 'Refused', not_done: 'Not done' },
  played: 'Hours played', city: 'City', memberSince: 'Member since',
  lastVisit: 'Last visit',
  never: 'Never',
  /** Where a member is tonight (console v3): their seat, waiting for one, gone home, or not at the club (`notHere`). */
  tonight: 'Tonight',
  notHere: '–',
  waiting: 'Waiting', left: 'Left',
  tonightKinds: { seated: 'Seated', notHere: 'Not here' },
  /** `{table}` is the table's name and `{seat}` its number: `Table 2 · 3` in the list, `Table 2, seat 3` in full. */
  seatShort: '{table} · {seat}',
  seatFull: '{table}, seat {seat}',
  /** Opens the member's seat on the live floor. */
  show: 'Show',
  showOnFloor: 'Show {name} on the floor',
  back: 'Back to Members',
  /** What promotions gave the member (console v3), newest first: `3 Nov 2026 · Triple points: 300 points`. */
  grantsTitle: 'Promotions given',
  noGrants: 'None yet.',
  grantLine: '{date} · {promotion}: {given}',
  grantPoints: '{count} points',
  grantChips: '{count} bonus chips',
  grantSpins: '{count} spins',
  grantSpin: '1 spin',
  /** The record. `{number}` is the member number. */
  memberNumber: 'Member {number}',
  /** `{date}`: 30 Nov 2026, the tier change's last day. */
  tierUntil: '{tier} until {date}',
  qualifying: 'Qualifies at {stakes}',
  kycVerified: 'KYC verified',
  kycIncomplete: 'KYC incomplete',
  inRoom: 'In the room',
  visitsTitle: 'Visits',
  /** The name a member gave at sign-up, under their Aadhaar name (#803): `Known as Ashu`. */
  knownAs: 'Known as {name}',
  /** The record's parts, one shown at a time (C-02); visits takes visitsTitle. `{name}` is the member's. */
  parts: { label: 'Record of {name}', bonus: 'Points and bonus chips', signUp: 'Sign-up', membership: 'Tier and break', account: 'Account' },
  /** The record's Sign-up (owner, 8 Nov). */
  signUp: memberSignUp,
  bonus: memberBonus,
  earlyDeparturesTitle: 'Early departures',
  noEarlyDepartures: 'No early departures.',
  /** One early departure: `{date}`, `{time}` of call time owed, why, and the admin who let them go. */
  earlyDeparture: '{date} · {time} short · {reason} · let go by {name}',
  /** A super admin withdraws one recorded by mistake (decision 0500). `{date}` is the early departure's. */
  withdraw: 'Withdraw',
  withdrawNamed: 'Withdraw the early departure of {date}',
  withdrawReason: 'Why the early departure of {date} is withdrawn',
  withdrawHint: 'In words, three characters or more.',
  withdrawConfirm: 'Withdraw it',
  /** `{date}` it was withdrawn, `{name}` the super admin, and why. */
  earlyDepartureWithdrawn: 'Withdrawn {date} by {name}: {reason}',
  withdrawFailures: {
    notAllowed: 'Only a super admin withdraws an early departure.',
    noMember: 'That member is not at this venue.',
    invalid: 'Give the reason in words, three characters or more.',
    paused: 'Venue frozen. Try again once it is released.',
    unavailable: 'Not withdrawn. Try again.',
    alreadyWithdrawn: 'Already withdrawn by someone else.',
    memberFrozen: 'This member is frozen. Try again once released.',
  },
  tierChange: 'Tier change',
  tiersUnavailable: 'The tiers did not load.',
  newTier: 'New tier',
  reason: 'Why',
  reasonHint: 'Recorded with your name.',
  until: 'Last day (optional)',
  untilHint: 'Empty keeps it. Ends the morning after.',
  save: 'Change tier',
  saved: 'Tier changed.',
  /** Feature overrides (#61), for super admins only: one feature granted or taken away for one member. */
  overrides: {
    title: 'Feature overrides',
    none: 'No overrides.',
    feature: 'Feature',
    kind: 'Override',
    grant: 'Grant',
    takeAway: 'Take away',
    granted: 'granted',
    takenAway: 'taken away',
    /** One override: `{feature}`, granted or taken away (`{what}`), why, and the super admin. */
    line: '{feature} {what} · {reason} · by {name}',
    /** With its last day, `{date}`: 22 Nov 2026. */
    lineUntil: '{feature} {what} until {date} · {reason} · by {name}',
    ended: 'Ended',
    replaced: 'Replaced',
    /** Lifted early: by whom, and why. */
    liftedBy: 'Lifted by {name}: {reason}',
    liftReason: 'Why it is lifted',
    reason: 'Why the override',
    until: 'Override\'s last day (optional)',
    untilHint: 'Empty keeps it. Ends the morning after.',
    lift: 'Lift',
    liftName: 'Lift the override of {feature}',
    newOverride: 'New override',
    save: 'Save override',
    saved: 'Override saved.',
    lifted: 'Override lifted.',
    featuresUnavailable: 'The features did not load.',
    failures: {
      notAllowed: 'Only a super admin overrides a feature.',
      noMember: 'That member is not at this venue.',
      invalid: 'A feature, a reason of 3 to 500 characters and a future last day.',
      paused: 'Venue frozen. Try again once it is released.',
      notInForce: 'That override has already ended or been replaced.',
      unavailable: 'Not sent. Try again.',
    },
  },
  /** Erasing one member's personal data on request, for super admins (#424, decision 0207). */
  /** A super admin changes a member's phone number, their login (#502). */
  changePhone: {
    title: 'Phone number',
    intro: 'Their number is their login. They sign in with the new one.',
    newNumber: 'New mobile number',
    newNumberHint: 'With +91, as +919876543210.',
    /** The member's number now, above the new one (F1-09). */
    current: 'Number now: {phone}',
    again: 'Type the new number again',
    differs: 'The two numbers are not the same.',
    /** Change number's second press. */
    confirm: 'Yes, change it to {phone}',
    reason: 'Why it changes',
    change: 'Change number',
    changed: 'Changed.',
    failures: {
      too_many: 'Ten changes this hour. Wait before another.',
      not_allowed: 'Only a super admin changes a member\'s number.',
      invalid: 'An Indian mobile with +91, and a reason without names or numbers.',
      taken: 'Another member or login already has that number.',
      staff_login: 'Also a staff login. Change it on Staff.',
      erased: 'This member was erased.',
      paused: 'The venue or the member is frozen.',
      unavailable: 'Not sent. Try again.',
    },
  },
  erase: {
    title: 'Erasure on request',
    intro: 'Removes this member\'s personal data for good: name, mobile number, login, KYC files and preferences. Money and tax records stay, by member number, without the person.',
    erased: 'This member\'s personal data was erased on request.',
    settleFirst: 'Clear these first: {items}.',
    blockers: {
      frozen: 'a freeze on the venue or the member',
      cash: 'cash in the wallet',
      chips: 'a visit or a seat still open',
      markers: 'markers not settled',
      rewards: 'points or bonus chips owed to the club',
      redemptions: 'a reward not yet handed over',
      waitlist: 'a place on a waitlist',
      tournament: 'a run in a tournament not yet finished',
      requests: 'a buy-in, withdrawal or deposit waiting',
      academy: 'an academy booking not paid',
    },
    /** `{bonus}`: bonus chips, `2,000` (#629). */
    forfeit: 'Forfeited to the club: {points} points and {bonus} bonus chips.',
    nothingToForfeit: 'No points or bonus chips to forfeit.',
    /** Hotel nights the erasure forfeits, or forfeited (#146): `1.25`. */
    nightsForfeit: 'Hotel nights forfeited to the club: {nights}.',
    blockNote: 'On a break until {date}: their number and identity stay blocked until then, by keyed hashes alone.',
    typeName: 'Type the member\'s full name to confirm',
    reason: 'Why the member is erased',
    reasonHint: 'Who asked, and how. No names or numbers.',
    erase: 'Erase personal data',
    done: 'Erased. Forfeited {points} points and {bonus} bonus chips; KYC files removed: {files}.',
    doneFilesLeft: 'Erased. Forfeited {points} points and {bonus} bonus chips. The KYC files are still to remove.',
    filesLeft: 'KYC files still to remove: {count}.',
    removeFiles: 'Remove KYC files',
    filesRemoved: 'KYC files removed: {count}.',
    filesNotRemoved: 'KYC files not removed. Try again.',
    failures: {
      notAllowed: 'Only a super admin erases a member.',
      wrongName: 'Type the member\'s full name exactly as the record shows it.',
      invalidReason: 'A reason of 3 to 300 characters, no names or numbers.',
      openItems: 'Clear the open items listed, then try again.',
      erased: 'This member was erased already.',
      tooSoon: 'Too many erasures this hour. Wait, then try again.',
      paused: 'The venue or the member is frozen. Release it first.',
      unavailable: 'Not erased. Try again.',
    },
  },
  /** The floor's break for a member (A5-14, decision 0053), for staff with members.manage. */
  break: {
    title: 'Break',
    intro: 'Tables close to the member until it ends. It cannot be shortened.',
    length: 'How long',
    lengths: { day: '24 hours', week: '7 days', month: '30 days', quarter: '90 days', year: '1 year', tenYears: '10 years' },
    reason: 'Why the break',
    reasonHint: 'Recorded with your name.',
    start: 'Start break',
    /** The second press. `{length}`: 30 days. */
    confirm: 'Yes, start a break of {length}',
    /** `{until}`: 2 Dec 2026, 00:00, with the year, as a break may run for years. */
    started: 'On a break until {until}.',
    failures: {
      not_allowed: 'Not in your role. Ask an admin.',
      no_member: 'That member is not at this venue.',
      invalid: 'Give a reason of 3 to 300 characters.',
      paused: 'Venue frozen. Try again once it is released.',
      unavailable: 'Not sent. Try again.',
    },
  },
  /** Why a tier change did not go through. */
  failures: {
    notAllowed: 'Not in your role. Ask an admin.',
    noMember: 'That member is not at this venue.',
    invalid: 'A different tier, a reason of 3 to 500 characters and a future last day.',
    paused: 'Venue frozen. Try again once it is released.',
    unavailable: 'Not sent. Try again.',
  },
};

/** The console's Tiers screen (#32): the tier x feature matrix, saved from a date, and a preview of the player app as a tier. */
export const tiers = {
  title: 'Tiers',
  notAllowed: 'Your role does not manage tiers. Ask an admin if you need it.',
  /** The tiers, by rank, above the matrix. */
  tierList: 'Tiers, lowest first: {tiers}',
  matrix: 'Features by tier',
  empty: 'No features to gate.',
  feature: 'Feature',
  /** A cell's group name for screen readers: `{feature}` for `{tier}`. */
  cellFor: '{feature} for {tier}',
  on: 'On',
  locked: 'Locked',
  hidden: 'Hidden',
  /** A change already saved for later, under a cell: `{date}` is when, `{state}` what. */
  scheduled: 'From {date}: {state}',
  withdraw: 'Withdraw',
  withdrawFor: 'Withdraw the change to {feature} for {tier}',
  /** The bar that saves the cells changed on screen. */
  unsaved: '{count} unsaved changes',
  unsavedOne: '1 unsaved change',
  when: 'When the change takes effect',
  now: 'Now',
  fromDate: 'From a date',
  date: 'Date (from midnight IST)',
  save: 'Save changes',
  discard: 'Discard',
  saved: 'Saved. Members\' apps change within seconds.',
  savedLater: 'Saved for {date}.',
  invalidDate: 'Choose a date after today, or Now.',
  notAllowedAction: 'Your role cannot change tiers. Ask an admin.',
  inPast: 'That date has passed, or the change is already in force. Choose another date.',
  changed: 'The tiers changed meanwhile. Check the matrix and save again.',
  unavailable: 'Not sent. Try again.',
  /** The preview of the player app as a member of one tier, with no override. */
  preview: 'Preview as a tier',
  previewTier: 'Tier to preview',
  previewOn: 'On: {features}',
  previewLocked: 'Locked: {features}',
  previewHidden: 'Hidden: {features}',
  previewNone: 'none',
};
