/** What the census opens: each screen of an app as each person who uses that app, and what that person should see. */
import { ROLE_PERMISSIONS, STAFF_ROLES, type StaffRole } from '@rivr/contracts';
import type { AppName, Role, Screen } from '../catalogue/types.ts';

/** Members in three states at 22:00: seated at a table, waiting on a list, and not yet checked by the desk. */
export const MEMBERS = ['member_seated', 'member_waiting', 'member_unchecked'] as const;
export type Member = (typeof MEMBERS)[number];
export const DEVICES = ['tablet', 'door', 'tv'] as const;
export type Device = (typeof DEVICES)[number];
/** Everyone the census signs in, plus the signed-out visitor. */
export type Person = StaffRole | Member | Device | 'visitor';

/**
 * - open: the screen shows for this person;
 * - refused: the console's own refusal (the role lacks the permission);
 * - moved: hidden or an old address, so it refuses or sends the person elsewhere, and shows no ₹;
 * - sign_in: signed out, the app asks for sign-in first.
 */
export type Expect = 'open' | 'refused' | 'moved' | 'sign_in';

export interface Visit {
  person: Person;
  screen: Screen;
  /** The address with its parameters filled in. */
  path: string;
  expect: Expect;
}

const PEOPLE: Readonly<Record<AppName, readonly Person[]>> = {
  console: STAFF_ROLES,
  player: [...MEMBERS, 'visitor'],
  tablet: ['tablet'],
  door: ['door'],
  display: ['tv'],
  web: ['visitor'],
};

const isStaff = (person: Person): person is StaffRole => STAFF_ROLES.some((role) => role === person);
const SIGNED_OUT_SCREENS = ['/sign-in', '/sign-up'];

/** The catalogue's role for a person: members and devices as one each, staff by their role. */
export function roleOf(person: Person): Role {
  if (isStaff(person)) return person;
  if (person === 'visitor') return 'visitor';
  return person.startsWith('member') ? 'member' : 'device';
}

export function mayOpen(role: StaffRole, screen: Screen): boolean {
  const held: readonly string[] = ROLE_PERMISSIONS[role];
  return screen.anyOf.length === 0 || screen.anyOf.some((permission) => held.includes(permission));
}

export function expectFor(person: Person, screen: Screen): Expect {
  if (screen.kind === 'hidden') return 'moved';
  const signedOutScreen = SIGNED_OUT_SCREENS.includes(screen.path);
  if (person === 'visitor' && screen.app === 'player') return signedOutScreen ? 'open' : 'sign_in';
  // Signed in, the sign-in and sign-up screens send a person on; an old console address moves to its tab.
  if (signedOutScreen || (screen.app === 'console' && screen.kind === 'route')) return 'moved';
  if (isStaff(person)) return mayOpen(person, screen) ? 'open' : 'refused';
  return 'open';
}

/** Fills `$name` parts of an address from `params`; null when one is missing (the visit is then not made). */
export function fillPath(path: string, params: Readonly<Record<string, string>>): string | null {
  let missing = false;
  const filled = path.replaceAll(/\$(\w+)/g, (_, name: string) => {
    const value = params[name];
    if (value === undefined) missing = true;
    return value ?? '';
  });
  return missing ? null : filled;
}

/** Every visit to the app's screens; `skipped` lists the addresses that had no parameter to fill. */
export function planVisits(screens: readonly Screen[], app: AppName, params: Readonly<Record<string, string>>): { visits: Visit[]; skipped: string[] } {
  const visits: Visit[] = [];
  const skipped: string[] = [];
  for (const screen of screens.filter((each) => each.app === app)) {
    const path = fillPath(screen.path, params);
    if (path === null) {
      skipped.push(screen.path);
      continue;
    }
    for (const person of PEOPLE[app]) visits.push({ person, screen, path, expect: expectFor(person, screen) });
  }
  return { visits, skipped };
}
