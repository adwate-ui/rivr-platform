import { err, linkSuffixSchema, ok, type Result } from '@rivr/contracts';
import type { AdapterFailure } from '../shared/failure.ts';
import { errorCodeFrom, messageIdFrom } from './parse/reply.ts';
import { WHATSAPP_TEMPLATES } from './templates.ts';
import type { WhatsAppAdapter, WhatsAppMessage } from './types.ts';

/** The Graph API version the requests name. Meta supports each version for about two years. */
export const GRAPH_API_VERSION = 'v23.0';

/** Every approved template is in English: RIVR ships in English only (decision 0027). */
const TEMPLATE_LANGUAGE = 'en';

// Meta's rate-limit error codes, worth retrying later (developers.facebook.com, WhatsApp Cloud API
// "Error codes"): 4 app calls, 80007 account calls, 130429 throughput, 131048 spam limit, 131056
// too many messages to one person.
const RATE_LIMIT_CODES = new Set([4, 80007, 130429, 131048, 131056]);

export interface WhatsAppCloudApiOptions {
  /** The WhatsApp Business number's id in Meta's dashboard (not the phone number itself). */
  readonly phoneNumberId: string;
  /** A system user's permanent access token with whatsapp_business_messaging. */
  readonly accessToken: string;
  /** For tests; the platform's fetch by default. */
  readonly fetch?: typeof globalThis.fetch;
  /**
   * How long to wait for Meta before giving up as unavailable. 4 seconds by default, inside the
   * 5 seconds Supabase Auth gives its Send SMS hook, so a slow reply still leaves time to answer Auth.
   */
  readonly timeoutMs?: number;
}

type Component =
  | { readonly type: 'body'; readonly parameters: readonly { type: 'text'; text: string }[] }
  | { readonly type: 'button'; readonly sub_type: 'url'; readonly index: '0'; readonly parameters: readonly { type: 'text'; text: string }[] };

/**
 * The template's parts: its body parameters, and a button's: the copy-code button of an authentication
 * template, or a link button's suffix (a payment link or a receipt, #62).
 */
function components(message: WhatsAppMessage): Component[] {
  const body: Component = { type: 'body', parameters: message.params.map((text) => ({ type: 'text', text })) };
  if (message.category !== 'authentication') {
    if (message.urlButton === undefined) return [body];
    return [body, { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: message.urlButton }] }];
  }
  // Meta requires an authentication template's code twice: in the body, and as the copy-code button's parameter.
  const code = message.params[0] ?? '';
  return [body, { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: code }] }];
}

function requestBody(message: WhatsAppMessage) {
  return {
    messaging_product: 'whatsapp',
    // Meta takes the number as digits only: +919876543210 becomes 919876543210.
    to: message.to.slice(1),
    type: 'template',
    template: { name: message.template, language: { code: TEMPLATE_LANGUAGE }, components: components(message) },
  };
}

/** Maps a refusal to a failure. The reason carries Meta's error code only, never the number or the text. */
function failureFrom(status: number, reply: unknown): AdapterFailure {
  const code = errorCodeFrom(reply);
  if (status === 429 || (code !== undefined && RATE_LIMIT_CODES.has(code))) return { code: 'rate_limited' };
  // A server error, or a refusal Meta did not explain, is treated as passing trouble and retried.
  if (status >= 500 || code === undefined) return { code: 'unavailable' };
  return { code: 'rejected', reason: `WhatsApp error ${code}` };
}

/** The reply's JSON, or undefined when the body is not JSON (a gateway's HTML error page, say). */
async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

/**
 * Why a message must not go: a marketing template sent as anything but marketing, which would reach a
 * member without their opt-in (Meta fixes a template's category when it approves it), or a link
 * suffix that could add a query or a host. Null when it may go.
 */
function refusal(message: WhatsAppMessage): string | null {
  const known = Object.entries(WHATSAPP_TEMPLATES).find(([name]) => name === message.template)?.[1];
  if (known?.category === 'marketing' && message.category !== 'marketing') return 'a marketing template needs the member\'s opt-in';
  if (message.urlButton !== undefined && !linkSuffixSchema.safeParse(message.urlButton).success) return 'the link suffix is not a plain path';
  return null;
}

/** WhatsApp through Meta's Cloud API directly (scope-v1, decision S-D3). Runs under Deno and Node. */
export function createWhatsAppCloudApi({
  phoneNumberId,
  accessToken,
  fetch = globalThis.fetch,
  timeoutMs = 4_000,
}: WhatsAppCloudApiOptions): WhatsAppAdapter {
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`;
  return {
    async sendTemplate(message): Promise<Result<{ readonly messageId: string }, AdapterFailure>> {
      const refused = refusal(message);
      if (refused !== null) return err({ code: 'rejected', reason: refused });
      let response: Response;
      try {
        response = await fetch(url, {
          method: 'POST',
          headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
          body: JSON.stringify(requestBody(message)),
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch {
        // A network failure, or no reply within the timeout.
        return err({ code: 'unavailable' });
      }
      const reply = await readJson(response);
      if (!response.ok) return err(failureFrom(response.status, reply));
      // Meta accepted it. Reporting a failure here would invite sending the same message again.
      return ok({ messageId: messageIdFrom(reply) ?? 'unknown' });
    },
  };
}
