import { err, ok, type Result } from '@rivr/contracts';
import type { AdapterFailure } from '../shared/failure.ts';
import type { EmailAdapter } from './types.ts';

/** Resend's send endpoint. */
export const RESEND_EMAILS_URL = 'https://api.resend.com/emails';

export interface ResendOptions {
  /** The account's API key, sending access only. */
  readonly apiKey: string;
  /** The From address on the club's domain, verified with Resend: `RIVR alerts <alerts@…>`. */
  readonly from: string;
  /** For tests; the platform's fetch by default. */
  readonly fetch?: typeof globalThis.fetch;
  /** How long to wait for Resend before giving up as unavailable. */
  readonly timeoutMs?: number;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

/** Maps a refusal to a failure. The reason never carries an address. */
function failureFrom(status: number): AdapterFailure {
  if (status === 429) return { code: 'rate_limited' };
  if (status >= 500) return { code: 'unavailable' };
  return { code: 'rejected', reason: `Resend refused (HTTP ${String(status)})` };
}

/** The message id Resend gives back, or 'unknown'. */
function idOf(body: unknown): string {
  if (typeof body !== 'object' || body === null || !('id' in body)) return 'unknown';
  return typeof body.id === 'string' ? body.id : 'unknown';
}

/** Email through Resend (#1066, the owner's choice): plain text, from the club's verified address. Runs under Deno and Node. */
export function createResendEmail({ apiKey, from, fetch = globalThis.fetch, timeoutMs = 10_000 }: ResendOptions): EmailAdapter {
  return {
    async send({ to, subject, text }): Promise<Result<{ readonly messageId: string }, AdapterFailure>> {
      let response: Response;
      try {
        response = await fetch(RESEND_EMAILS_URL, {
          method: 'POST',
          headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
          body: JSON.stringify({ from, to, subject, text }),
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch {
        return err({ code: 'unavailable' });
      }
      if (!response.ok) return err(failureFrom(response.status));
      return ok({ messageId: idOf(await readJson(response)) });
    },
  };
}
