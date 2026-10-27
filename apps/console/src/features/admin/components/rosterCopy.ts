import type { RosterFailure } from '@rivr/db/roster';
import type { MessageKey } from '@rivr/i18n';

/** Why a roster change did not go through, as the console says it. */
export const ROSTER_FAILURE_COPY: Readonly<Record<RosterFailure, MessageKey>> = {
  not_allowed: 'console.rosterFailures.notAllowed',
  invalid: 'console.rosterFailures.invalid',
  overlap: 'console.rosterFailures.overlap',
  paused: 'console.rosterFailures.paused',
  unavailable: 'console.rosterFailures.unavailable',
};
