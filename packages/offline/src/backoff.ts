import type { RetryPolicy } from './types.ts';

/** One second, doubling to a minute: quick when Wi-Fi blinks, quiet when it is down for a while. */
export const DEFAULT_RETRY: RetryPolicy = { firstDelayMs: 1_000, maxDelayMs: 60_000 };

/** The wait before the next attempt after `failures` failed attempts in a row: 1 s, 2 s, 4 s, up to the cap. */
export function retryDelay(failures: number, policy: RetryPolicy): number {
  return Math.min(policy.maxDelayMs, policy.firstDelayMs * 2 ** Math.max(0, failures - 1));
}
