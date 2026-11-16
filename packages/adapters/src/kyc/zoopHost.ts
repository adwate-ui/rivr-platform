import type { AdapterFailure } from '../shared/failure.ts';

// What every Zoop product shares (decision 0671): how to reach it, and how a reply that is not an answer is read.

/** How to reach Zoop.one, RIVR's KYC vendor (decision 0671). */
export interface ZoopOptions {
  readonly appId: string;
  readonly apiKey: string;
  /** `test` with the Test App's key (local and staging), `live` with the production app's. */
  readonly environment: 'test' | 'live';
  /**
   * Whether the PAN's name is the name given: `namesMatch` from `@rivr/domain/identity`. It is passed in because this
   * package does not import the domain package; every Edge Function that imports adapters would need it mapped.
   */
  readonly namesMatch: (documentName: string, givenName: string) => boolean;
  /** For tests; the platform's fetch by default. */
  readonly fetch?: typeof globalThis.fetch;
  /** How long to wait for Zoop before giving up as unavailable; 15 seconds by default. */
  readonly timeoutMs?: number;
}

// The test host is the one RIVR has called; the live host is as Zoop's documentation names it, not yet called.
export const BASE_URL = { test: 'https://test.zoop.one', live: 'https://live.zoop.one' } as const;
export const UNAVAILABLE: AdapterFailure = { code: 'unavailable' };

// Zoop's codes for its own or its source's trouble (source error, timed out, down, internal, unknown), as its 2022
// documentation lists them: worth asking again.
const RETRY_LATER = new Set(['99', '108', '109', '110', '111']);

// Zoop's answers about RIVR's account, not a request: a key it does not take (401), a product not on the app or a key
// for the other host (403), a wallet running low (402, its 112). Every request would get the same.
const ACCOUNT_CODES = new Set(['401', '402', '403', '112']);

/**
 * A refusal as a failure. The reason names Zoop's code only: its messages can repeat what was sent. A refusal of the
 * account is marked so (decision 0674), as is a reply that is not Zoop's at all (a path it does not have, a firewall's
 * page): that is the set-up's trouble, not the request's.
 */
export function zoopFailure(status: number, code: string | undefined): AdapterFailure {
  if (status === 429) return { code: 'rate_limited' };
  if (status >= 500 || (code !== undefined && RETRY_LATER.has(code))) return UNAVAILABLE;
  const reason = `Zoop ${code !== undefined && /^\d{1,4}$/.test(code) ? code : `HTTP ${status}`}`;
  const isAccount = code === undefined || ACCOUNT_CODES.has(code) || ACCOUNT_CODES.has(String(status));
  return isAccount ? { code: 'rejected', reason, cause: 'account' } : { code: 'rejected', reason };
}
