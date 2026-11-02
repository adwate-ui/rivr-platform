import { err, ok, type Result } from '@rivr/contracts';
import { z } from 'zod';
import type { AdapterFailure } from '../shared/failure.ts';
import { refusal } from './live.ts';
import { WHATSAPP_TEMPLATES } from './templates.ts';
import type { WhatsAppAdapter, WhatsAppMessage } from './types.ts';

export interface WhatsAppEvolutionOptions {
  /** The bridge's address, https://…, as Maneman's and poker-settle's use it. */
  readonly baseUrl: string;
  /** The bridge's key, sent as the `apikey` header. */
  readonly apiKey: string;
  /** The bridge's instance: the WhatsApp account RIVR sends from. */
  readonly instance: string;
  /** For tests; the platform's fetch by default. */
  readonly fetch?: typeof globalThis.fetch;
  /** As the Cloud API's: 4 seconds by default, inside the 5 seconds Auth gives its Send SMS hook. */
  readonly timeoutMs?: number;
}

const sentReplySchema = z.object({ key: z.object({ id: z.string().min(1) }) });

/** The template's text with its numbered parameters filled in, or null when a parameter is missing. */
function textOf(message: WhatsAppMessage): string | null {
  const template = Object.entries(WHATSAPP_TEMPLATES).find(([name]) => name === message.template)?.[1];
  if (template === undefined) return null;
  let missing = false;
  const text = template.body.replace(/\{\{(\d+)\}\}/g, (_match, index: string) => {
    const param = message.params[Number(index) - 1];
    if (param === undefined) missing = true;
    return param ?? '';
  });
  return missing ? null : text;
}

/** Why the bridge refused, from the status and the reply's text only: the reply can echo the number. */
function failureFrom(status: number, reply: string): AdapterFailure {
  if (reply.includes('"exists":false')) return { code: 'rejected', reason: 'the number is not on WhatsApp' };
  if (status === 429) return { code: 'rate_limited' };
  // No such instance, a refused key, a logged-out phone or a server error: the bridge's trouble, worth trying again.
  if ([401, 403, 404].includes(status) || status >= 500 || reply.includes('Connection Closed')) return { code: 'unavailable' };
  return { code: 'rejected', reason: `WhatsApp bridge error ${status}` };
}

/** The message id from an accepted reply, or undefined when the reply is not the shape the bridge documents. */
function messageIdFrom(reply: string): string | undefined {
  try {
    return sentReplySchema.safeParse(JSON.parse(reply)).data?.key.id;
  } catch {
    return undefined;
  }
}

/**
 * WhatsApp through an Evolution API bridge, for now (decision 0297), as Maneman sends it: the bridge drives a
 * WhatsApp account the way WhatsApp Web does, so there are no Meta templates. Each message is its template's
 * text from `WHATSAPP_TEMPLATES`, sent as plain text: `POST {baseUrl}/message/sendText/{instance}` with
 * `{ number, text }`. A link button has no plain-text form, so a message with one is refused. Runs under Deno and Node.
 */
export function createWhatsAppEvolution({ baseUrl, apiKey, instance, fetch = globalThis.fetch, timeoutMs = 4_000 }: WhatsAppEvolutionOptions): WhatsAppAdapter {
  const url = `${baseUrl.replace(/\/+$/, '')}/message/sendText/${encodeURIComponent(instance)}`;
  return {
    async sendTemplate(message): Promise<Result<{ readonly messageId: string }, AdapterFailure>> {
      const refused = refusal(message) ?? (message.urlButton === undefined ? null : 'the bridge sends no link buttons');
      if (refused !== null) return err({ code: 'rejected', reason: refused });
      const text = textOf(message);
      if (text === null) return err({ code: 'rejected', reason: `template ${message.template} is unknown or missing a parameter` });
      let response: Response;
      try {
        response = await fetch(url, {
          method: 'POST',
          headers: { apikey: apiKey, 'content-type': 'application/json' },
          // The bridge takes the number as digits only: +919876543210 becomes 919876543210.
          body: JSON.stringify({ number: message.to.slice(1), text }),
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch {
        // A network failure, or no reply within the timeout.
        return err({ code: 'unavailable' });
      }
      const reply = await response.text().catch(() => '');
      if (!response.ok) return err(failureFrom(response.status, reply));
      // The bridge accepted it. Reporting a failure here would invite sending the same message again.
      return ok({ messageId: messageIdFrom(reply) ?? 'unknown' });
    },
  };
}
