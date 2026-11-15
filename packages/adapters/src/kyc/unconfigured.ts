import { err } from '@rivr/contracts';
import type { KycAdapter } from './types.ts';

const NOT_CONFIGURED = err({ code: 'not_configured' } as const);

/**
 * KYC for a real venue whose vendor keys have not arrived: every check fails closed, so nobody is
 * verified by a fake and staff review the documents by hand (docs/decisions/0014). It has every step, liveness too, so
 * even the selfie is refused.
 */
export function createUnconfiguredKyc(): Required<KycAdapter> {
  return {
    startDigiLocker: async () => NOT_CONFIGURED,
    pullDigiLocker: async () => NOT_CONFIGURED,
    verifyPan: async () => NOT_CONFIGURED,
    checkLiveness: async () => NOT_CONFIGURED,
    matchFace: async () => NOT_CONFIGURED,
  };
}
