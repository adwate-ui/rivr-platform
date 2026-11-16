import { err } from '@rivr/contracts';
import type { KycAdapter } from './types.ts';

const NOT_CONFIGURED = err({ code: 'not_configured' } as const);

/**
 * KYC for a real venue whose vendor keys have not arrived: no vendor check goes through, so nobody is verified by a fake
 * (docs/decisions/0014). It checks no liveness, so the member's selfie is kept, as with Zoop; the DigiLocker hand-off then
 * cannot start, and the check waits for the desk, which checks the documents in person (the owner, 16 Nov 2026; decision
 * 0678).
 */
export function createUnconfiguredKyc(): Required<Omit<KycAdapter, 'checkLiveness'>> {
  return {
    startDigiLocker: async () => NOT_CONFIGURED,
    pullDigiLocker: async () => NOT_CONFIGURED,
    readDigiLockerDelivery: () => NOT_CONFIGURED,
    verifyPan: async () => NOT_CONFIGURED,
    matchFace: async () => NOT_CONFIGURED,
  };
}
