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
  /** Why a tier change did not go through. */
  failures: {
    notAllowed: 'Your role does not change tiers. Ask a membership manager.',
    noMember: 'That member is not at this venue.',
    invalid: 'Choose a different tier, give a reason of 3 to 500 characters, and a last day still to come.',
    paused: 'The venue is frozen. Tiers change again once it is released.',
    unavailable: 'That did not go through. Check the connection and try again.',
  },
};
