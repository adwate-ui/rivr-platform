import type { DeviceFailure } from '@rivr/db';
import type { MessageKey } from '@rivr/i18n';

/** What the console's Tablets screen says when adding, pairing, fixing or revoking did not go through. */
export const DEVICE_FAILURE_COPY: Readonly<Record<DeviceFailure, MessageKey>> = {
  not_allowed: 'console.tablets.notAllowedAction',
  paused: 'console.tablets.paused',
  invalid: 'console.tablets.changed',
  unavailable: 'console.tablets.unavailable',
};
