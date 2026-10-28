import { err, ok, type Result } from '@rivr/contracts';
import type { AdapterFailure } from '../shared/failure.ts';
import type { InstagramGraphAdapter, TaggedPost } from './types.ts';

/** The Graph API version the requests name, as the WhatsApp client's. */
const GRAPH_API_VERSION = 'v23.0';
const FIELDS = 'id,username,caption,media_url,media_type,permalink,timestamp';

export interface InstagramGraphOptions {
  /** The club's Instagram professional account id (not its handle). */
  readonly instagramUserId: string;
  /** A long-lived token with instagram_basic and instagram_manage_comments. */
  readonly accessToken: string;
  /** For tests; the platform's fetch by default. */
  readonly fetch?: typeof globalThis.fetch;
  readonly timeoutMs?: number;
}

/** One tagged post as Instagram gives it, or null when a field the wall needs is missing. */
function postFrom(row: unknown): TaggedPost | null {
  const field = (name: string): unknown => (typeof row === 'object' && row !== null ? Reflect.get(row, name) : undefined);
  const [id, username, mediaUrl, permalink, timestamp] = ['id', 'username', 'media_url', 'permalink', 'timestamp'].map(field);
  if (typeof id !== 'string' || typeof username !== 'string' || typeof mediaUrl !== 'string' || typeof permalink !== 'string' || typeof timestamp !== 'string') return null;
  const caption = field('caption');
  return {
    id, username, mediaUrl, permalink, caption: typeof caption === 'string' ? caption : '',
    mediaKind: field('media_type') === 'VIDEO' ? 'video' : 'image', postedAt: new Date(timestamp),
  };
}

/** The posts in a reply, or an empty list when it holds none. */
function postsFrom(reply: unknown): TaggedPost[] {
  const data: unknown = typeof reply === 'object' && reply !== null ? Reflect.get(reply, 'data') : undefined;
  return Array.isArray(data) ? data.flatMap((row) => postFrom(row) ?? []) : [];
}

/** Instagram's Graph API for the posts that tag the club (#157). Runs under Deno and Node. */
export function createInstagramGraph({ instagramUserId, accessToken, fetch = globalThis.fetch, timeoutMs = 10_000 }: InstagramGraphOptions): InstagramGraphAdapter {
  return {
    async listTaggedPosts({ since, limit }): Promise<Result<readonly TaggedPost[], AdapterFailure>> {
      const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${instagramUserId}/tags?fields=${FIELDS}&limit=${String(limit)}`;
      let response: Response;
      try {
        response = await fetch(url, { headers: { authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(timeoutMs) });
      } catch {
        return err({ code: 'unavailable' });
      }
      if (response.status === 429) return err({ code: 'rate_limited' });
      if (!response.ok) return err(response.status >= 500 ? { code: 'unavailable' } : { code: 'rejected', reason: `Instagram error ${String(response.status)}` });
      const reply: unknown = await response.json().catch(() => undefined);
      return ok(postsFrom(reply).filter((post) => post.postedAt >= since));
    },
  };
}
