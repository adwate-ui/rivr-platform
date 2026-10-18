import type { AcademyFailure } from '@rivr/db';
import type { MessageKey } from '@rivr/i18n';

/** What the screen says for each way an Academy step can fail. */
export const FAILURE_COPY: Readonly<Record<AcademyFailure, MessageKey>> = {
  full: 'player.academy.full',
  closed: 'player.academy.closed',
  not_open: 'player.academy.notOpen',
  stopped: 'player.academy.stopped',
  no_fee: 'player.academy.noFee',
  invalid_utr: 'player.academy.utrInvalid',
  utr_used: 'player.academy.utrUsed',
  unavailable: 'player.academy.unavailable',
};
