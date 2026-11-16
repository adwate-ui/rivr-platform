import { err, ok, type Result } from '@rivr/contracts';
import type { AdapterFailure } from '../shared/failure.ts';
import type { VerifyNowAdapter, VerifyNowRefusal } from './types.ts';

/** Message Central's API, where VerifyNow lives. */
export const VERIFY_NOW_URL = 'https://cpaas.messagecentral.com';

export interface VerifyNowOptions {
  /** The account's customer id, `C-…`. */
  readonly customerId: string;
  /** The account's password, which Message Central takes base64-encoded. */
  readonly password: string;
  /** For tests; the platform's fetch by default. */
  readonly fetch?: typeof globalThis.fetch;
  /** How long to wait for each of Message Central's replies before giving up as unavailable. */
  readonly timeoutMs?: number;
}

/** The reply codes the adapter acts on, from VerifyNow's API guide. */
const SUCCESS = 200;
const INVALID_VERIFICATION_ID = 505;
const ALREADY_SENT = 506;
const VERIFICATION_FAILED = 700;
const WRONG_CODE = 702;
const ALREADY_VERIFIED = 703;
const EXPIRED = 705;
const LIMIT_REACHED = 800;

/** A reply read as far as the adapter needs it; null when none came. */
interface Reply {
  readonly status: number;
  /** VerifyNow's own code, in the body even when the HTTP status says otherwise. */
  readonly responseCode: number | null;
  readonly data: Record<string, unknown>;
  readonly token: unknown;
}

function field(value: unknown, name: string): unknown {
  return typeof value === 'object' && value !== null ? Reflect.get(value, name) : undefined;
}

async function call(fetch: typeof globalThis.fetch, url: string, init: RequestInit): Promise<Reply | null> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    return null;
  }
  const body: unknown = await response.json().catch(() => undefined);
  const responseCode = Number(field(body, 'responseCode'));
  const data = field(body, 'data');
  return {
    status: response.status,
    responseCode: Number.isInteger(responseCode) ? responseCode : null,
    data: typeof data === 'object' && data !== null ? Object.fromEntries(Object.entries(data)) : {},
    token: field(body, 'token'),
  };
}

/** Base64 of the password's UTF-8 bytes, as Message Central's `key`. */
function keyOf(password: string): string {
  return btoa(String.fromCharCode(...new TextEncoder().encode(password)));
}

/** A refusal of a send, without the number in the reason. */
function sendFailure(reply: Reply | null): AdapterFailure {
  if (reply === null || reply.status >= 500) return { code: 'unavailable' };
  if (reply.responseCode === LIMIT_REACHED || reply.status === 429) return { code: 'rate_limited' };
  return { code: 'rejected', reason: `VerifyNow refused (${String(reply.responseCode ?? reply.status)})` };
}

function checkRefusal(reply: Reply | null): VerifyNowRefusal {
  switch (reply?.responseCode) {
    case WRONG_CODE:
    case VERIFICATION_FAILED:
      return 'wrong_code';
    case EXPIRED:
    case INVALID_VERIFICATION_ID:
    case ALREADY_VERIFIED:
      return 'expired';
    case LIMIT_REACHED:
      return 'too_many';
    default:
      return 'unavailable';
  }
}

/** How long a token is reused before asking for another. A token refused sooner (401) is replaced at once. */
const TOKEN_REUSE_MS = 10 * 60_000;

/**
 * VerifyNow over Message Central's REST API (its "Quick Onboarding Guide"). A token, asked for with the
 * customer id and key, goes as the `authToken` header of each call; it is reused for ten minutes, so a
 * send or a check is usually one request. Runs under Deno and Node.
 */
export function createVerifyNow({ customerId, password, fetch = globalThis.fetch, timeoutMs = 2_000 }: VerifyNowOptions): VerifyNowAdapter {
  const get = (path: string, query: Record<string, string>, headers: Record<string, string> = {}, method = 'GET') =>
    call(fetch, `${VERIFY_NOW_URL}${path}?${new URLSearchParams(query).toString()}`, { method, headers, signal: AbortSignal.timeout(timeoutMs) });
  let kept: { readonly token: string; readonly until: number } | null = null;

  /** A new token, or null when Message Central gives none (down, or the account refused). */
  async function newToken(): Promise<string | null> {
    const reply = await get('/auth/v1/authentication/token', { customerId, key: keyOf(password), scope: 'NEW', country: '91' });
    const token = typeof reply?.token === 'string' && reply.token !== '' ? reply.token : null;
    kept = token === null ? null : { token, until: Date.now() + TOKEN_REUSE_MS };
    return token;
  }

  /** Makes one call with a token: the kept one, or a new one if there is none or Message Central refused the kept one. */
  async function withToken(make: (headers: { authToken: string }) => Promise<Reply | null>): Promise<Reply | null> {
    const reused = kept !== null && kept.until > Date.now() ? kept.token : null;
    const authToken = reused ?? (await newToken());
    if (authToken === null) return null;
    const reply = await make({ authToken });
    if (reply?.status !== 401 || reused === null) return reply;
    const fresh = await newToken();
    return fresh === null ? null : make({ authToken: fresh });
  }

  return {
    async send({ to }) {
      // VerifyNow takes the ten digits and the country code apart: +919876543210 is 91 and 9876543210.
      const query = { countryCode: '91', customerId, flowType: 'SMS', mobileNumber: to.slice(3), otpLength: '6' };
      const reply = await withToken((headers) => get('/verification/v3/send', query, headers, 'POST'));
      const verificationId = reply?.data.verificationId;
      if (reply?.responseCode === SUCCESS && (typeof verificationId === 'string' || typeof verificationId === 'number')) {
        return ok({ verificationId: String(verificationId) });
      }
      return reply?.responseCode === ALREADY_SENT ? ok({ verificationId: null }) : err(sendFailure(reply));
    },

    async check({ verificationId, code }): Promise<Result<null, VerifyNowRefusal>> {
      // GET, as the guide's example has it: Message Central answers a POST here with 401.
      const reply = await withToken((headers) => get('/verification/v3/validateOtp', { verificationId, code }, headers));
      if (reply?.responseCode === SUCCESS && reply.data.verificationStatus === 'VERIFICATION_COMPLETED') return ok(null);
      return err(checkRefusal(reply));
    },
  };
}
