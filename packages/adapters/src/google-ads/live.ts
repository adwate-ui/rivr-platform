import { err, ok, type Result } from '@rivr/contracts';
import type { AdapterFailure } from '../shared/failure.ts';
import { toClickConversion } from './click-conversion.ts';
import type { GoogleAdsConversionsAdapter } from './types.ts';

/** The Google Ads API version the requests name. Google retires each about a year after its release: check at setup. */
export const GOOGLE_ADS_API_VERSION = 'v22';

export interface GoogleAdsOptions {
  /** The account's developer token, from the API Center of the manager account. */
  readonly developerToken: string;
  /** An OAuth client and a refresh token for a user who can reach the account. */
  readonly clientId: string;
  readonly clientSecret: string;
  readonly refreshToken: string;
  /** The account the conversions go to, digits only. */
  readonly customerId: string;
  /** The manager account, digits only, when the user reaches the account through one. */
  readonly loginCustomerId?: string;
  /** For tests; the platform's fetch and clock by default. */
  readonly fetch?: typeof globalThis.fetch;
  readonly now?: () => number;
  readonly timeoutMs?: number;
}

type Call = (url: string, init: RequestInit) => Promise<Result<unknown, AdapterFailure>>;

function failureFrom(status: number): AdapterFailure {
  if (status === 429) return { code: 'rate_limited' };
  if (status >= 500) return { code: 'unavailable' };
  return { code: 'rejected', reason: `Google Ads error ${status}` };
}

/** One request: the reply's JSON when it succeeded, or why it did not. */
function caller(fetch: typeof globalThis.fetch, timeoutMs: number): Call {
  return async (url, init) => {
    let response: Response;
    try {
      response = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
    } catch {
      return err({ code: 'unavailable' });
    }
    if (!response.ok) return err(failureFrom(response.status));
    return ok(await response.json().catch(() => undefined));
  };
}

function field(reply: unknown, name: string): unknown {
  return typeof reply === 'object' && reply !== null ? Reflect.get(reply, name) : undefined;
}

/** An access token from the refresh token, kept until a minute before it expires. */
function tokens(options: GoogleAdsOptions, call: Call, now: () => number): () => Promise<Result<string, AdapterFailure>> {
  let kept: { readonly token: string; readonly until: number } | null = null;
  return async () => {
    if (kept !== null && kept.until > now()) return ok(kept.token);
    const form = new URLSearchParams({
      grant_type: 'refresh_token', client_id: options.clientId, client_secret: options.clientSecret, refresh_token: options.refreshToken,
    });
    const reply = await call('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form.toString(),
    });
    if (!reply.ok) return reply;
    const token = field(reply.value, 'access_token');
    const seconds = field(reply.value, 'expires_in');
    if (typeof token !== 'string') return err({ code: 'unavailable' });
    kept = { token, until: now() + ((typeof seconds === 'number' ? seconds : 0) - 60) * 1000 };
    return ok(token);
  };
}

/**
 * The live offline conversion import (#162), enabled and not behind a flag (14 Oct additions, "Resolved conflicts"): each
 * conversion uploaded with the phone hashed (toClickConversion). Google drops a second upload with the same order id.
 */
export function createGoogleAdsConversions(options: GoogleAdsOptions): GoogleAdsConversionsAdapter {
  const call = caller(options.fetch ?? globalThis.fetch, options.timeoutMs ?? 10_000);
  const accessToken = tokens(options, call, options.now ?? Date.now);
  const url = `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${options.customerId}:uploadClickConversions`;
  return {
    async upload(conversion) {
      const token = await accessToken();
      if (!token.ok) return token;
      const reply = await call(url, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token.value}`, 'developer-token': options.developerToken, 'content-type': 'application/json',
          ...(options.loginCustomerId ? { 'login-customer-id': options.loginCustomerId } : {}),
        },
        body: JSON.stringify({ conversions: [await toClickConversion(conversion)], partialFailure: true }),
      });
      if (!reply.ok) return reply;
      // With partial failure on, a refused conversion comes back in a 200 reply.
      if (field(reply.value, 'partialFailureError') !== undefined) return err({ code: 'rejected', reason: 'Google Ads refused the conversion' });
      return ok({ accepted: 1 });
    },
  };
}
