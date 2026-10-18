import type { KycFailure } from '@rivr/db';
import type { MessageKey } from '@rivr/i18n';

/** What the screen says for each way a KYC step can fail. */
export const FAILURE_COPY: Readonly<Record<KycFailure, MessageKey>> = {
  not_configured: 'player.kyc.notConfigured',
  not_live: 'player.kyc.notLive',
  pan_rejected: 'player.kyc.panRejected',
  stopped: 'player.kyc.stopped',
  too_many_attempts: 'player.kyc.tooManyAttempts',
  unavailable: 'player.kyc.unavailable',
};
