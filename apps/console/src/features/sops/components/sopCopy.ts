import type { StaffRole } from '@rivr/contracts';
import type { Sop, SopFailure, SopVersion } from '@rivr/db';
import { formatDate, formatList, t, type MessageKey } from '@rivr/i18n';

const FAILURE_COPY: Readonly<Record<SopFailure, MessageKey>> = {
  not_allowed: 'console.sops.notAllowed',
  paused: 'console.sops.paused',
  day: 'console.sops.day',
  taken: 'console.sops.taken',
  changed: 'console.sops.changed',
  unavailable: 'console.sops.unavailable',
};

/** An IST calendar day as the database keeps it, `2026-11-01`, written `1 Nov 2026`. */
function dayText(day: string): string {
  return formatDate(new Date(`${day}T12:00:00+05:30`));
}

/** The version in force: its number, its day and its owner. */
export function versionText(version: SopVersion): string {
  return t('console.sops.version', { version: version.version, date: dayText(version.effectiveOn), owner: version.owner });
}

/** A version waiting for its day. */
export function waitingText(next: SopVersion): string {
  return t('console.sops.waiting', { version: next.version, date: dayText(next.effectiveOn) });
}

const ROLE_NAMES: Readonly<Record<StaffRole, MessageKey>> = {
  super_admin: 'console.sops.roleNames.super_admin',
  admin: 'console.sops.roleNames.admin',
  cashier: 'console.sops.roleNames.cashier',
  dealer: 'console.sops.roleNames.dealer',
  marketing: 'console.sops.roleNames.marketing',
  host: 'console.sops.roleNames.host',
  owner_view: 'console.sops.roleNames.owner_view',
};

/** A role's name in the plural: Dealers. */
export function roleName(role: StaffRole): string {
  return t(ROLE_NAMES[role]);
}

/** The roles a version asks to acknowledge it. */
export function rolesText(roles: readonly StaffRole[]): string {
  return roles.length === 0 ? t('console.sops.noRoles') : t('console.sops.roles', { roles: formatList(roles.map(roleName)) });
}

/** Where the signed-in staff member stands on the version in force; null when nothing is asked of them. */
export function standingText(sop: Sop): string | null {
  if (sop.acknowledgedAt !== null) return t('console.sops.acknowledgedOn', { date: formatDate(new Date(sop.acknowledgedAt)) });
  return sop.mustAcknowledge ? t('console.sops.mustAcknowledge') : null;
}

/** The lines of an SOP's text, blank lines left out. */
export function bodyLines(body: string): string[] {
  return body.split('\n').map((line) => line.trim()).filter((line) => line.length > 0);
}

/** Why an SOP step did not go through. */
export function sopFailureText(failure: SopFailure): string {
  return t(FAILURE_COPY[failure]);
}
