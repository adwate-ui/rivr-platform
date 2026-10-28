import { err, ok, type SocialChannel } from '@rivr/contracts';
import type { AdapterFailure } from '../shared/failure.ts';
import type { ChannelAnalyticsAdapter, FollowerCount } from './types.ts';

/** The Graph API version the requests name, as the WhatsApp client's. */
const GRAPH_API_VERSION = 'v23.0';

/** Where one channel's follower count is read: a JSON endpoint, and the path to the number in its reply. */
export interface FollowerSource {
  readonly url: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly path: readonly string[];
}

/**
 * Each channel's follower count as its API gives it (#164). Google Business Profile and WhatsApp give none, so they are
 * not counted.
 */
export const followerSources = {
  instagram: (userId: string, token: string): FollowerSource => ({
    url: `https://graph.facebook.com/${GRAPH_API_VERSION}/${userId}?fields=followers_count`, headers: { authorization: `Bearer ${token}` }, path: ['followers_count'],
  }),
  facebook: (pageId: string, token: string): FollowerSource => ({
    url: `https://graph.facebook.com/${GRAPH_API_VERSION}/${pageId}?fields=followers_count`, headers: { authorization: `Bearer ${token}` }, path: ['followers_count'],
  }),
  x: (userId: string, token: string): FollowerSource => ({
    url: `https://api.x.com/2/users/${userId}?user.fields=public_metrics`, headers: { authorization: `Bearer ${token}` },
    path: ['data', 'public_metrics', 'followers_count'],
  }),
  linkedin: (organizationId: string, token: string): FollowerSource => ({
    url: `https://api.linkedin.com/rest/networkSizes/urn%3Ali%3Aorganization%3A${organizationId}?edgeType=COMPANY_FOLLOWED_BY_MEMBER`,
    headers: { authorization: `Bearer ${token}`, 'linkedin-version': '202510', 'x-restli-protocol-version': '2.0.0' }, path: ['firstDegreeSize'],
  }),
  youtube: (channelId: string, apiKey: string): FollowerSource => ({
    url: `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${channelId}&key=${apiKey}`, path: ['items', '0', 'statistics', 'subscriberCount'],
  }),
  telegram: (botToken: string, chat: string): FollowerSource => ({
    url: `https://api.telegram.org/bot${botToken}/getChatMemberCount?chat_id=${encodeURIComponent(chat)}`, path: ['result'],
  }),
} as const;

/** The number at `path` in the reply (YouTube gives it as text), or null when it is not a count. */
function countAt(reply: unknown, path: readonly string[]): number | null {
  let value = reply;
  for (const key of path) value = typeof value === 'object' && value !== null ? Reflect.get(value, key) : undefined;
  const count = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  return typeof count === 'number' && Number.isInteger(count) && count >= 0 ? count : null;
}

function failureFrom(status: number): AdapterFailure {
  if (status === 429) return { code: 'rate_limited' };
  if (status >= 500) return { code: 'unavailable' };
  return { code: 'rejected', reason: `follower count refused (${status})` };
}

/** The live follower counts: each channel the club has connected (`sources`); any other is not configured. */
export function createChannelAnalytics({ sources, fetch = globalThis.fetch, now = () => new Date(), timeoutMs = 10_000 }: {
  sources: Partial<Readonly<Record<SocialChannel, FollowerSource>>>;
  /** For tests; the platform's fetch and clock by default. */
  fetch?: typeof globalThis.fetch;
  now?: () => Date;
  timeoutMs?: number;
}): ChannelAnalyticsAdapter {
  return {
    async followerCount({ channel }) {
      const source = sources[channel];
      if (source === undefined) return err({ code: 'not_configured' });
      let response: Response;
      try {
        response = await fetch(source.url, { headers: { ...source.headers }, signal: AbortSignal.timeout(timeoutMs) });
      } catch {
        return err({ code: 'unavailable' });
      }
      if (!response.ok) return err(failureFrom(response.status));
      const followers = countAt(await response.json().catch(() => undefined), source.path);
      if (followers === null) return err({ code: 'unavailable' });
      return ok({ channel, followers, measuredAt: now() });
    },
  };
}

/** Every channel's count that could be read tonight, and the channels that failed (not those never connected). */
export async function collectFollowerCounts(analytics: ChannelAnalyticsAdapter, channels: readonly SocialChannel[]) {
  const answers = await Promise.all(channels.map(async (channel) => ({ channel, answer: await analytics.followerCount({ channel }) })));
  const counts: FollowerCount[] = [];
  const failed: SocialChannel[] = [];
  for (const { channel, answer } of answers) {
    if (answer.ok) counts.push(answer.value);
    else if (answer.error.code !== 'not_configured') failed.push(channel);
  }
  return { counts, failed };
}
