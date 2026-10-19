import { err, ok, type Result } from '@rivr/contracts';
import type { AdapterFailure } from '../shared/failure.ts';
import type { SmsOtpAdapter } from './types.ts';

/** MSG91's OTP endpoint (API v5). */
export const MSG91_OTP_URL = 'https://control.msg91.com/api/v5/otp';

export interface Msg91Options {
  /** The account's auth key. Its IP security must allow Supabase's Edge Functions, which have no fixed address. */
  readonly authKey: string;
  /** The MSG91 OTP template, which carries the DLT template registered for sign-in codes. */
  readonly templateId: string;
  /** For tests; the platform's fetch by default. */
  readonly fetch?: typeof globalThis.fetch;
  /** How long to wait for MSG91 before giving up as unavailable; inside Auth's 5 seconds. */
  readonly timeoutMs?: number;
}

/** MSG91's reply: `type` says whether it was sent, even when the HTTP status is 200. */
function replyOf(body: unknown): { type?: unknown; request_id?: unknown; message?: unknown } {
  return typeof body === 'object' && body !== null ? body : {};
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

/** Maps a refusal to a failure. The reason never carries the number or the code. */
function failureFrom(status: number, reply: { message?: unknown }): AdapterFailure {
  const message = typeof reply.message === 'string' ? reply.message.toLowerCase() : '';
  if (status === 429 || message.includes('limit')) return { code: 'rate_limited' };
  if (status >= 500) return { code: 'unavailable' };
  return { code: 'rejected', reason: `MSG91 refused (HTTP ${String(status)})` };
}

/**
 * Sign-in codes by SMS through MSG91 (#181), on a DLT-registered template. Runs under Deno and Node.
 * The code goes as the template's OTP; MSG91 does not generate one of its own.
 */
export function createMsg91SmsOtp({ authKey, templateId, fetch = globalThis.fetch, timeoutMs = 3_000 }: Msg91Options): SmsOtpAdapter {
  return {
    async sendOtp({ to, code }): Promise<Result<{ readonly messageId: string }, AdapterFailure>> {
      // MSG91 takes the number as digits with the country code: +919876543210 becomes 919876543210.
      const query = new URLSearchParams({ template_id: templateId, mobile: to.slice(1), otp: code });
      let response: Response;
      try {
        response = await fetch(`${MSG91_OTP_URL}?${query.toString()}`, {
          method: 'POST',
          // The key goes as a header, never in the address, so no log of the URL holds it.
          headers: { authkey: authKey, 'content-type': 'application/json' },
          body: '{}',
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch {
        return err({ code: 'unavailable' });
      }
      const reply = replyOf(await readJson(response));
      if (!response.ok || reply.type !== 'success') return err(failureFrom(response.status, reply));
      return ok({ messageId: typeof reply.request_id === 'string' ? reply.request_id : 'unknown' });
    },
  };
}
