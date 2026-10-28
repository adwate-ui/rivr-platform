import { err, ok } from '@rivr/contracts';
import type { AdapterFailure } from '../shared/failure.ts';
import { toMetaServerEvent } from './server-event.ts';
import type { MetaConversionsAdapter } from './types.ts';

/** The Graph API version the requests name, as the WhatsApp client's. */
const GRAPH_API_VERSION = 'v23.0';

// Meta's rate-limit error codes, worth retrying later: 4 app calls, 17 user calls, 32 page calls, 613 calls within a time.
const RATE_LIMIT_CODES = new Set([4, 17, 32, 613]);

export interface MetaConversionsApiOptions {
  /** The dataset (pixel) id the events go to, in Events Manager. */
  readonly pixelId: string;
  /** A system user's access token for the dataset. */
  readonly accessToken: string;
  /** For tests; the platform's fetch by default. */
  readonly fetch?: typeof globalThis.fetch;
  readonly timeoutMs?: number;
}

/** A field of the reply, or undefined when it is not an object (a gateway's HTML page, say). */
function field(reply: unknown, ...path: string[]): unknown {
  let value = reply;
  for (const key of path) value = typeof value === 'object' && value !== null ? Reflect.get(value, key) : undefined;
  return value;
}

/** Maps a refusal to a failure. The reason carries Meta's error code only. */
function failureFrom(status: number, reply: unknown): AdapterFailure {
  const code = field(reply, 'error', 'code');
  if (status === 429 || (typeof code === 'number' && RATE_LIMIT_CODES.has(code))) return { code: 'rate_limited' };
  if (status >= 500 || typeof code !== 'number') return { code: 'unavailable' };
  return { code: 'rejected', reason: `Meta error ${code}` };
}

/**
 * The live Conversions API (#161): each event to the club's dataset, from a physical store, with hashed identifiers only
 * (toMetaServerEvent). Meta drops a second event with the same event id.
 */
export function createMetaConversionsApi({ pixelId, accessToken, fetch = globalThis.fetch, timeoutMs = 10_000 }: MetaConversionsApiOptions): MetaConversionsAdapter {
  return {
    async send(event) {
      const body = JSON.stringify({ data: [await toMetaServerEvent(event)] });
      let response: Response;
      try {
        response = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${pixelId}/events`, {
          method: 'POST',
          headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
          body,
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch {
        return err({ code: 'unavailable' });
      }
      const reply: unknown = await response.json().catch(() => undefined);
      if (!response.ok) return err(failureFrom(response.status, reply));
      const received = field(reply, 'events_received');
      return ok({ eventsReceived: typeof received === 'number' ? received : 0 });
    },
  };
}
