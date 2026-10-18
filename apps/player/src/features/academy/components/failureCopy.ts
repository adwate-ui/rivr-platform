import type { AcademyFailure } from '@rivr/db';
import type { MessageKey } from '@rivr/i18n';

/** What the screen says for each way an Academy step can fail. */
export const FAILURE_COPY: Readonly<Record<AcademyFailure, MessageKey>> = {
  full: 'player.academy.full',
  closed: 'player.academy.closed',
  not_open: 'player.academy.notOpen',
  stopped: 'player.academy.stopped',
  // The same words as the banner every screen shows while the club is paused.
  paused: 'ui.killSwitch.member',
  no_fee: 'player.academy.noFee',
  invalid_utr: 'player.academy.utrInvalid',
  utr_used: 'player.academy.utrUsed',
  utr_locked: 'player.academy.utrLocked',
  unavailable: 'player.academy.unavailable',
};
