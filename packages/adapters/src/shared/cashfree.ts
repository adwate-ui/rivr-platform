import { err, ok, type Result } from '@rivr/contracts';
import type { z } from 'zod';
import type { AdapterFailure } from './failure.ts';

/**
 * Cashfree, the vendor for KYC (Secure ID, #474) and UPI payouts (#475): one account, one key pair. Both
 * products authenticate the same way, so both adapters call through this client.
 */
export interface CashfreeOptions {
  readonly clientId: string;
  readonly clientSecret: string;
  /** `sandbox` with the TEST keys (local and staging), `production` with the live ones. */
  readonly environment: 'sandbox' | 'production';
  /**
   * The account's two-factor public key (PEM). Each call is signed with it, because Edge Functions have no
   * fixed address for Cashfree to whitelist. A PEM pasted on one line, its breaks lost, still reads.
   */
  readonly publicKey: string;
  /** For tests; the platform's fetch by default. */
  readonly fetch?: typeof globalThis.fetch;
  /** How long to wait for Cashfree before giving up as unavailable; 15 seconds by default. */
  readonly timeoutMs?: number;
  /** For tests: the clock the signature reads. */
  readonly now?: () => Date;
}

const BASE_URL = { sandbox: 'https://sandbox.cashfree.com', production: 'https://api.cashfree.com' } as const;

/** A request to Cashfree: a JSON body, or a form with files (liveness, face match). */
export interface CashfreeRequest {
  readonly method: 'GET' | 'POST';
  /** From the host, product included: `/verification/pan-lite`, `/payout/transfers`. */
  readonly path: string;
  readonly json?: unknown;
  readonly form?: FormData;
  /** The `x-api-version` the endpoint asks for, when it asks for one. */
  readonly apiVersion?: string;
}

function bytesOfPem(pem: string): Uint8Array<ArrayBuffer> {
  const body = pem.replace(/-----(BEGIN|END) PUBLIC KEY-----/g, '').replace(/\s+/g, '');
  return Uint8Array.from(atob(body), (char) => char.charCodeAt(0));
}

function base64Of(bytes: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}

/**
 * Cashfree's `x-cf-signature`: `<client id>.<unix seconds>`, encrypted with the account's public key
 * (RSA-OAEP with SHA-1, as Cashfree's Java samples name it), in base64. It is good for five minutes.
 */
export async function cashfreeSignature(clientId: string, publicKey: string, at: Date): Promise<string> {
  const key = await crypto.subtle.importKey('spki', bytesOfPem(publicKey), { name: 'RSA-OAEP', hash: 'SHA-1' }, false, ['encrypt']);
  const text = new TextEncoder().encode(`${clientId}.${Math.floor(at.getTime() / 1000)}`);
  return base64Of(await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, key, text));
}

/** The reply's JSON, or undefined when the body is not JSON (a gateway's HTML error page, say). */
async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

function codeOf(reply: unknown): string | undefined {
  if (typeof reply !== 'object' || reply === null || !('code' in reply)) return undefined;
  return typeof reply.code === 'string' ? reply.code : undefined;
}

/**
 * A refusal as a failure. The reason names Cashfree's error code only: its messages can carry the caller's
 * address or what was sent.
 */
export function cashfreeFailure(status: number, reply: unknown): AdapterFailure {
  if (status === 429) return { code: 'rate_limited' };
  if (status >= 500) return { code: 'unavailable' };
  return { code: 'rejected', reason: `Cashfree ${codeOf(reply) ?? `HTTP ${status}`}` };
}

/** Calls Cashfree, signed, and gives back the reply's JSON or why it failed. */
export function createCashfreeClient(options: CashfreeOptions) {
  const doFetch = options.fetch ?? globalThis.fetch;
  const now = options.now ?? (() => new Date());
  return {
    async request(request: CashfreeRequest): Promise<Result<unknown, AdapterFailure>> {
      try {
        const headers = new Headers({
          'x-client-id': options.clientId,
          'x-client-secret': options.clientSecret,
          'x-cf-signature': await cashfreeSignature(options.clientId, options.publicKey, now()),
        });
        if (request.apiVersion !== undefined) headers.set('x-api-version', request.apiVersion);
        if (request.json !== undefined) headers.set('content-type', 'application/json');
        const response = await doFetch(`${BASE_URL[options.environment]}${request.path}`, {
          method: request.method, headers, signal: AbortSignal.timeout(options.timeoutMs ?? 15_000),
          body: request.form ?? (request.json === undefined ? null : JSON.stringify(request.json)),
        });
        const reply = await readJson(response);
        return response.ok ? ok(reply) : err(cashfreeFailure(response.status, reply));
      } catch {
        return err({ code: 'unavailable' });
      }
    },
  };
}

export type CashfreeClient = ReturnType<typeof createCashfreeClient>;

/** A reply read through its schema, or unavailable when it is not what Cashfree documents. */
export function parsed<T>(schema: z.ZodType<T>, reply: Result<unknown, AdapterFailure>): Result<T, AdapterFailure> {
  if (!reply.ok) return reply;
  const read = schema.safeParse(reply.value);
  return read.success ? ok(read.data) : err({ code: 'unavailable' });
}
