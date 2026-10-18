import { err, ok, type Result } from '@rivr/contracts';
import type { AdapterFailure } from '../shared/failure.ts';
import { errorCodeFrom, messageIdFrom } from './parse/reply.ts';
import type { WhatsAppAdapter, WhatsAppMessage } from './types.ts';

/** The Graph API version the requests name. Meta supports each version for about two years. */
export const GRAPH_API_VERSION = 'v23.0';

// Meta's error codes for throughput and per-user pair limits, worth retrying later.
const RATE_LIMIT_CODES = new Set([4, 80007, 130429, 131048, 131056]);

export interface WhatsAppCloudApiOptions {
  /** The WhatsApp Business number's id in Meta's dashboard (not the phone number itself). */
  readonly phoneNumberId: string;
  /** A system user's permanent access token with whatsapp_business_messaging. */
  readonly accessToken: string;
  /** For tests; the platform's fetch by default. */
  readonly fetch?: typeof globalThis.fetch;
}

type Component =
  | { readonly type: 'body'; readonly parameters: readonly { type: 'text'; text: string }[] }
  | { readonly type: 'button'; readonly sub_type: 'url'; readonly index: '0'; readonly parameters: readonly { type: 'text'; text: string }[] };

/** The template's parts: its body parameters, and for an authentication template the copy-code button. */
function components(message: WhatsAppMessage): Component[] {
  const body: Component = { type: 'body', parameters: message.params.map((text) => ({ type: 'text', text })) };
  if (message.category !== 'authentication') return [body];
  const code = message.params[0] ?? '';
  return [body, { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: code }] }];
}

function requestBody(message: WhatsAppMessage) {
  return {
    messaging_product: 'whatsapp',
    to: message.to.slice(1),
    type: 'template',
    template: { name: message.template, language: { code: message.language }, components: components(message) },
  };
}

/** Maps a refusal to a failure. The reason carries Meta's error code only, never the number or the text. */
function failureFrom(status: number, reply: unknown): AdapterFailure {
  const code = errorCodeFrom(reply);
  if (status === 429 || (code !== undefined && RATE_LIMIT_CODES.has(code))) return { code: 'rate_limited' };
  if (status >= 500 || code === undefined) return { code: 'unavailable' };
  return { code: 'rejected', reason: `WhatsApp error ${code}` };
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

/** WhatsApp through Meta's Cloud API directly (scope-v1, decision S-D3). Runs under Deno and Node. */
export function createWhatsAppCloudApi({ phoneNumberId, accessToken, fetch = globalThis.fetch }: WhatsAppCloudApiOptions): WhatsAppAdapter {
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`;
  return {
    async sendTemplate(message): Promise<Result<{ readonly messageId: string }, AdapterFailure>> {
      let response: Response;
      try {
        response = await fetch(url, {
          method: 'POST',
          headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
          body: JSON.stringify(requestBody(message)),
        });
      } catch {
        return err({ code: 'unavailable' });
      }
      const reply = await readJson(response);
      if (!response.ok) return err(failureFrom(response.status, reply));
      const messageId = messageIdFrom(reply);
      return messageId === undefined ? err({ code: 'unavailable' }) : ok({ messageId });
    },
  };
}
