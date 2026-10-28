import { err, ok, type Result } from '@rivr/contracts';
import type { AdapterFailure } from '../shared/failure.ts';
import type { SocialPost, SocialPublishingTarget } from './types.ts';

/** The Graph API version the requests name, as the WhatsApp client's. */
const GRAPH_API_VERSION = 'v23.0';
const GRAPH = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

// Meta's rate-limit error codes, worth retrying later: 4 app calls, 17 user calls, 32 page calls, 613 calls within a time.
const RATE_LIMIT_CODES = new Set([4, 17, 32, 613]);

interface LiveOptions {
  /** For tests; the platform's fetch by default. */
  readonly fetch?: typeof globalThis.fetch;
  readonly timeoutMs?: number;
}

/** A field at `path` in a reply, or undefined. */
function field(reply: unknown, ...path: string[]): unknown {
  let value = reply;
  for (const key of path) value = typeof value === 'object' && value !== null ? Reflect.get(value, key) : undefined;
  return value;
}

function graphFailure(status: number, reply: unknown): AdapterFailure {
  const code = field(reply, 'error', 'code');
  if (status === 429 || (typeof code === 'number' && RATE_LIMIT_CODES.has(code))) return { code: 'rate_limited' };
  if (status >= 500 || typeof code !== 'number') return { code: 'unavailable' };
  return { code: 'rejected', reason: `Meta error ${code}` };
}

/** How a target reaches its API: the fetch to use and how long to wait. */
interface Http {
  readonly fetch: typeof globalThis.fetch;
  readonly timeoutMs: number;
}

/** One Graph API call with the token in a header: the reply, or why it failed. A body makes it a POST. */
async function graph({ fetch, timeoutMs }: Http, url: string, token: string, body?: object): Promise<Result<unknown, AdapterFailure>> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    return err({ code: 'unavailable' });
  }
  const reply: unknown = await response.json().catch(() => undefined);
  return response.ok ? ok(reply) : err(graphFailure(response.status, reply));
}

/** The post's image: every connected channel posts one image (decision 0269). */
function imageOf(post: SocialPost): string | null {
  return post.media.find((media) => media.kind === 'image')?.url ?? null;
}

const noImage = err<AdapterFailure>({ code: 'rejected', reason: 'the post has no image' });

/** Instagram's content publishing: a media container for the image and caption, published, then its permalink. */
export function createInstagramTarget({ instagramUserId, accessToken, fetch = globalThis.fetch, timeoutMs = 15_000 }: LiveOptions & {
  /** The club's Instagram professional account id, and a token with instagram_content_publish. */
  readonly instagramUserId: string;
  readonly accessToken: string;
}): SocialPublishingTarget {
  const call = (url: string, body?: object) => graph({ fetch, timeoutMs }, url, accessToken, body);
  return {
    channel: 'instagram',
    async publish(post) {
      const image = imageOf(post);
      if (image === null) return noImage;
      const container = await call(`${GRAPH}/${instagramUserId}/media`, { image_url: image, caption: post.caption });
      if (!container.ok) return container;
      const published = await call(`${GRAPH}/${instagramUserId}/media_publish`, { creation_id: field(container.value, 'id') });
      if (!published.ok) return published;
      // Posted now: a failed link lookup must not send it again, so the account's home stands in.
      const link = await call(`${GRAPH}/${String(field(published.value, 'id'))}?fields=permalink`);
      const permalink = link.ok ? field(link.value, 'permalink') : undefined;
      const postUrl = typeof permalink === 'string' && permalink.startsWith('https://') ? permalink : 'https://www.instagram.com/';
      return ok({ kind: 'published', channel: 'instagram', postUrl });
    },
  };
}

/** A Facebook Page photo post: the image by its address, with the caption. */
export function createFacebookPageTarget({ pageId, pageToken, fetch = globalThis.fetch, timeoutMs = 15_000 }: LiveOptions & {
  /** The club's Page id, and a Page access token with pages_manage_posts. */
  readonly pageId: string;
  readonly pageToken: string;
}): SocialPublishingTarget {
  return {
    channel: 'facebook',
    async publish(post) {
      const image = imageOf(post);
      if (image === null) return noImage;
      const posted = await graph({ fetch, timeoutMs }, `${GRAPH}/${pageId}/photos`, pageToken, { url: image, message: post.caption });
      if (!posted.ok) return posted;
      // Posted: without the post's id in the reply, the Page stands in rather than posting again.
      const postId = field(posted.value, 'post_id');
      return ok({ kind: 'published', channel: 'facebook', postUrl: `https://www.facebook.com/${typeof postId === 'string' ? postId : pageId}` });
    },
  };
}

function telegramFailure(status: number, reply: unknown): AdapterFailure {
  if (status === 429) return { code: 'rate_limited' };
  if (status >= 500) return { code: 'unavailable' };
  return { code: 'rejected', reason: `Telegram error ${String(field(reply, 'error_code') ?? status)}` };
}

/** The message's link: by the channel's public name, or by its id for a private channel. */
function telegramLink(message: unknown): string | null {
  const id = field(message, 'message_id');
  const username = field(message, 'chat', 'username');
  const chatId = field(message, 'chat', 'id');
  if (typeof id !== 'number') return null;
  if (typeof username === 'string') return `https://t.me/${username}/${id}`;
  return typeof chatId === 'number' ? `https://t.me/c/${String(chatId).replace(/^-100/, '')}/${id}` : null;
}

/** A Telegram channel post through the club's bot (an admin of the channel): the image with its caption. */
export function createTelegramTarget({ botToken, chat, fetch = globalThis.fetch, timeoutMs = 15_000 }: LiveOptions & {
  readonly botToken: string;
  /** The channel's @name or numeric id. */
  readonly chat: string;
}): SocialPublishingTarget {
  return {
    channel: 'telegram',
    async publish(post) {
      const image = imageOf(post);
      if (image === null) return noImage;
      let response: Response;
      try {
        response = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ chat_id: chat, photo: image, caption: post.caption }), signal: AbortSignal.timeout(timeoutMs),
        });
      } catch {
        return err({ code: 'unavailable' });
      }
      const reply: unknown = await response.json().catch(() => undefined);
      if (!response.ok) return err(telegramFailure(response.status, reply));
      // Sent: without a link to the message, the channel stands in rather than sending again.
      const link = telegramLink(field(reply, 'result')) ?? `https://t.me/${chat.replace(/^@/, '')}`;
      return ok({ kind: 'published', channel: 'telegram', postUrl: link });
    },
  };
}
