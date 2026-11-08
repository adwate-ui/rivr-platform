/** Every invariant code in sql/12_checks.sql and sql/13_checks_people.sql: its area and where the rule comes from. */

export type Area = 'ledger' | 'state' | 'features' | 'privacy' | 'messages' | 'races' | 'harness';

export interface Code {
  area: Area;
  /** The decision, finding or design section the rule comes from. */
  source: string;
}

export const CODES: Readonly<Record<string, Code>> = {
  L01: { area: 'ledger', source: '90-day run L01: double entry' },
  L02: { area: 'ledger', source: '90-day run L02: one unit a transaction' },
  L03: { area: 'ledger', source: '90-day run L03, widened to every request id a live screen sends' },
  S01: { area: 'state', source: '90-day run S01' },
  S02: { area: 'state', source: '90-day run S02' },
  S03: { area: 'state', source: '90-day run S03, plus design 3a: no place, request, top-up, order or time request outlives its night' },
  S07: { area: 'state', source: '90-day run S07: the outbox' },
  S08: { area: 'state', source: '90-day run S08' },
  S09: { area: 'privacy', source: 'CLAUDE.md rule 4: the practice venue never reaches an external consumer' },
  N01: { area: 'features', source: 'Bonus chips never expire (#839); balance equals grants less redemptions (design 3a)' },
  N02: { area: 'features', source: 'Play-time bonus steps paid once and only while seated (#842, #847)' },
  N03: { area: 'features', source: 'Points daily staff cap with an owner alert (owner, 3 Nov)' },
  N04: { area: 'features', source: 'Bonus chips by hand: a reason, never on the giver’s own record (#842, #844)' },
  N05: { area: 'features', source: 'Locked points apart from points and bonus chips (#840, #842)' },
  N07: { area: 'messages', source: 'Workflow audit 2 Nov: each hand-off sends one message' },
  N08: { area: 'messages', source: 'Design 2: the right person; owner alerts to the alert number only' },
  N09: { area: 'privacy', source: 'Self-exclusion: refused at the door, the waitlist and seating (design 3a)' },
  N10: { area: 'privacy', source: 'The investor reads no member names or phones (90-day P01, audit 28 Oct P0)' },
  N11: { area: 'privacy', source: 'Hidden names never reach a TV (90-day P08, decision on TV names)' },
  N12: { area: 'features', source: 'KYC at the club: a reopened check pays no second welcome grant (5 Nov)' },
  N13: { area: 'privacy', source: 'Hidden names never reach a TV, checked at 23:00 with the room full' },
  P04: { area: 'privacy', source: '90-day run P04: two people release a freeze' },
  P05: { area: 'privacy', source: '90-day run P05: nothing moves while frozen' },
  P07: { area: 'privacy', source: '90-day run P07: erasure leaves no trace' },
  R01: { area: 'races', source: 'Design 2: two floor staff seat the same member' },
  R02: { area: 'races', source: 'Design 2: a double tap on an order' },
  R03: { area: 'races', source: 'Design 2: a double tap on a top-up' },
  R04: { area: 'races', source: 'Design 2: a double tap on a reward' },
  R05: { area: 'races', source: 'Design 2: an approval racing the member leaving' },
  X02: { area: 'harness', source: '90-day run X02: the harness named something wrongly' },
  X03: { area: 'harness', source: 'Build plan: every call an app makes can be run' },
};

/** The codes a block of check SQL names, in the order it names them. */
export function codesIn(sqlText: string): string[] {
  return [...sqlText.matchAll(/sim\.check\(d, p_scope, '([A-Z]\d{2})'/g)].map((match) => match[1] ?? '');
}
