import type { ControlFailure, EngagedControl } from '@rivr/db';
import { t, type MessageKey } from '@rivr/i18n';

/** Why a control did not change, for the super admin. */
export const CONTROL_FAILURE_COPY: Readonly<Record<ControlFailure, MessageKey>> = {
  not_allowed: 'console.killSwitch.failures.notAllowed',
  invalid: 'console.killSwitch.failures.invalid',
  no_member: 'console.killSwitch.failures.noMember',
  no_staff: 'console.killSwitch.failures.noStaff',
  needs_second: 'console.killSwitch.failures.needsSecond',
  last_engagers: 'console.killSwitch.failures.lastEngagers',
  unavailable: 'console.killSwitch.failures.unavailable',
};

/** What a control is: its level, and its feature, member or staff member when it has one. */
export function controlName(control: EngagedControl): string {
  const level = t(`console.killSwitch.levels.${control.level}`);
  const target = control.feature === null ? (control.memberName ?? control.staffName) : t(`console.killSwitch.features.${control.feature}`);
  return target === null ? level : t('console.killSwitch.withTarget', { level, target });
}
