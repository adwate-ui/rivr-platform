import type { CageFailure } from '@rivr/db';
import type { MessageKey } from '@rivr/i18n';

/** Why chips were not issued, for the cashier. */
export const CAGE_FAILURE_COPY: Readonly<Record<CageFailure, MessageKey>> = {
  not_allowed: 'console.cage.notAllowed',
  no_member: 'console.cage.noMember',
  stopped: 'console.cage.stopped',
  paused: 'console.cage.paused',
  kyc_needed: 'console.cage.kycBlock',
  on_break: 'console.cage.onBreak',
  not_seated: 'console.cage.notSeatedBlock',
  not_chips: 'console.cage.notChips',
  below_minimum: 'console.cage.belowMinimum',
  wallet_short: 'console.cage.walletShort',
  utr_used: 'console.cage.utrUsed',
  moved: 'console.cage.moved',
  not_in_room: 'console.cage.notInRoom',
  invalid: 'console.cage.invalid',
  unavailable: 'console.cage.unavailable',
};
