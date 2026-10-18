import { err } from '@rivr/contracts';
import type { UpiPayoutAdapter } from './types.ts';

const NOT_CONFIGURED = err({ code: 'not_configured' } as const);

/**
 * Payouts for a real venue with no provider yet: every call fails closed, so no withdrawal is ever
 * marked sent by a fake. The cage pays by hand and enters the UTR (docs/decisions/0014).
 */
export function createUnconfiguredUpiPayouts(): UpiPayoutAdapter {
  return {
    pay: async () => NOT_CONFIGURED,
    getPayout: async () => NOT_CONFIGURED,
    verifyVpa: async () => NOT_CONFIGURED,
  };
}
