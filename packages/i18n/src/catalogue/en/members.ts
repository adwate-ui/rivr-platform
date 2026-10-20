/** The console's Members screen (#60): find a member, open their record, and change their tier. */
export const members = {
  title: 'Members',
  notAllowed: 'Your role does not include members. Ask an admin if you need it.',
  search: 'Find a member',
  searchHint: 'A name, four or more digits of a mobile number, or a member number.',
  searchPrompt: 'Type a member number, two or more letters of a name, or four or more digits of a mobile number.',
  /** `{query}` is what was typed. */
  noMatch: 'No member matches {query}.',
  number: 'No.',
  name: 'Member',
  mobile: 'Mobile',
  tier: 'Tier',
  visits: 'Visits',
  lastVisit: 'Last visit',
  never: 'Never',
  /** The button on a found member's row. */
  open: 'Open {name}',
  /** The record. `{number}` is the member number. */
  memberNumber: 'Member {number}',
  /** `{date}`: 30 Nov 2026, the tier change's last day. */
  tierUntil: '{tier} until {date}',
  qualifying: 'Qualifies at {stakes}',
  kycVerified: 'KYC verified',
  kycIncomplete: 'KYC incomplete',
  inRoom: 'In the room',
  visitsTitle: 'Visits',
  /** `{count}` visits, the last on `{date}`. */
  visitsLine: '{count} visits, the last on {date}',
  visitsOne: '1 visit, on {date}',
  noVisits: 'No visits yet.',
  earlyDeparturesTitle: 'Early departures',
  noEarlyDepartures: 'No early departures.',
  /** One early departure: `{date}`, `{time}` of call time owed, why, and the admin who let them go. */
  earlyDeparture: '{date} · {time} short · {reason} · let go by {name}',
  tierChange: 'Tier change',
  tiersUnavailable: 'The tiers did not load.',
  newTier: 'New tier',
  reason: 'Why',
  reasonHint: 'Kept with the change, with your name.',
  until: 'Last day (optional)',
  untilHint: 'Leave it empty to keep the tier. The morning after this day, they go back.',
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
    untilHint: 'Leave it empty to keep it. It ends the morning after this day.',
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
      invalid: 'Choose a feature, give a reason of 3 to 500 characters, and a last day still to come.',
      paused: 'The venue is frozen. Overrides change again once it is released.',
      notInForce: 'That override has already ended or been replaced.',
      unavailable: 'That did not go through. Check the connection and try again.',
    },
  },
  /** Why a tier change did not go through. */
  failures: {
    notAllowed: 'Your role does not change tiers. Ask a membership manager.',
    noMember: 'That member is not at this venue.',
    invalid: 'Choose a different tier, give a reason of 3 to 500 characters, and a last day still to come.',
    paused: 'The venue is frozen. Tiers change again once it is released.',
    unavailable: 'That did not go through. Check the connection and try again.',
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
  unavailable: 'That did not go through. Check the connection and try again.',
  /** The preview of the player app as a member of one tier, with no override. */
  preview: 'Preview as a tier',
  previewTier: 'Tier to preview',
  previewOn: 'On: {features}',
  previewLocked: 'Locked: {features}',
  previewHidden: 'Hidden: {features}',
  previewNone: 'none',
};
