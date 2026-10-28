import type { CameraFailure } from '@rivr/db/cctv';
import type { MessageKey } from '@rivr/i18n';

/** Why a camera was not saved, as the console says it. */
export const CAMERA_FAILURE_COPY: Readonly<Record<CameraFailure, MessageKey>> = {
  not_allowed: 'console.cameraFailures.notAllowed',
  invalid: 'console.cameraFailures.invalid',
  taken: 'console.cameraFailures.taken',
  paused: 'console.cameraFailures.paused',
  unavailable: 'console.cameraFailures.unavailable',
};
