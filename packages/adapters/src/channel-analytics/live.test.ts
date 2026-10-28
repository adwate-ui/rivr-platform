import { describe, expect, it } from 'vitest';
import { collectFollowerCounts, createChannelAnalytics, createFakeChannelAnalytics, followerSources } from './index.ts';

const now = () => new Date('2026-11-16T18:30:00Z');

/** A fetch that answers each URL from `replies` by its start, and records what was asked. */
function fakeFetch(replies: Record<string, { status?: number; body: unknown }>) {
  const asked: { url: string; headers: unknown }[] = [];
  const fetch: typeof globalThis.fetch = async (input, init = {}) => {
    asked.push({ url: String(input), headers: init.headers });
    const reply = Object.entries(replies).find(([start]) => String(input).startsWith(start))?.[1];
    if (reply === undefined) throw new TypeError('network down');
    return Response.json(reply.body, { status: reply.status ?? 200 });
  };
  return { fetch, asked };
}

describe('live follower counts', () => {
  it('reads each connected channel\u2019s count where its API gives it', async () => {
    const { fetch, asked } = fakeFetch({
      'https://graph.facebook.com/v23.0/17841': { body: { followers_count: 1200, id: '17841' } },
      'https://www.googleapis.com/youtube/': { body: { items: [{ statistics: { subscriberCount: '340' } }] } },
      'https://api.telegram.org/': { body: { ok: true, result: 95 } },
      'https://api.x.com/': { body: { data: { public_metrics: { followers_count: 50 } } } },
      'https://api.linkedin.com/': { body: { firstDegreeSize: 77 } },
    });
    const analytics = createChannelAnalytics({
      sources: {
        instagram: followerSources.instagram('17841', 'ig-token'), youtube: followerSources.youtube('UC1', 'yt-key'),
        telegram: followerSources.telegram('bot-token', '@rivrclub'), x: followerSources.x('44', 'x-token'), linkedin: followerSources.linkedin('9', 'li-token'),
      },
      fetch, now,
    });

    expect(await analytics.followerCount({ channel: 'instagram' })).toEqual({ ok: true, value: { channel: 'instagram', followers: 1200, measuredAt: now() } });
    expect((await analytics.followerCount({ channel: 'youtube' })).ok && 340).toBe(340);
    expect(await collectFollowerCounts(analytics, ['instagram', 'youtube', 'telegram', 'x', 'linkedin', 'whatsapp'])).toEqual({
      counts: [
        { channel: 'instagram', followers: 1200, measuredAt: now() }, { channel: 'youtube', followers: 340, measuredAt: now() },
        { channel: 'telegram', followers: 95, measuredAt: now() }, { channel: 'x', followers: 50, measuredAt: now() },
        { channel: 'linkedin', followers: 77, measuredAt: now() },
      ],
      failed: [],
    });
    expect(asked[0]).toEqual({ url: 'https://graph.facebook.com/v23.0/17841?fields=followers_count', headers: { authorization: 'Bearer ig-token' } });
    expect(asked.some((call) => call.url === 'https://api.telegram.org/botbot-token/getChatMemberCount?chat_id=%40rivrclub')).toBe(true);
  });

  it('counts a channel that failed, but not one never connected', async () => {
    const { fetch } = fakeFetch({ 'https://graph.facebook.com/': { status: 400, body: { error: { code: 190 } } }, 'https://api.x.com/': { body: { data: {} } } });
    const analytics = createChannelAnalytics({
      sources: { facebook: followerSources.facebook('1', 't'), x: followerSources.x('2', 't'), telegram: followerSources.telegram('b', '@c') }, fetch, now,
    });
    expect(await analytics.followerCount({ channel: 'facebook' })).toEqual({ ok: false, error: { code: 'rejected', reason: 'follower count refused (400)' } });
    expect(await collectFollowerCounts(analytics, ['facebook', 'x', 'telegram', 'whatsapp'])).toEqual({ counts: [], failed: ['facebook', 'x', 'telegram'] });
  });

  it('retries a rate limit or an outage', async () => {
    const limited = createChannelAnalytics({ sources: { x: followerSources.x('2', 't') }, fetch: fakeFetch({ 'https://api.x.com/': { status: 429, body: {} } }).fetch });
    expect(await limited.followerCount({ channel: 'x' })).toEqual({ ok: false, error: { code: 'rate_limited' } });
    const down = createChannelAnalytics({ sources: { x: followerSources.x('2', 't') }, fetch: fakeFetch({ 'https://api.x.com/': { status: 503, body: {} } }).fetch });
    expect(await down.followerCount({ channel: 'x' })).toEqual({ ok: false, error: { code: 'unavailable' } });
  });

  it('works with the fake too', async () => {
    const fake = createFakeChannelAnalytics({ now });
    fake.setFollowers('instagram', 10);
    expect((await collectFollowerCounts(fake, ['instagram'])).counts).toEqual([{ channel: 'instagram', followers: 10, measuredAt: now() }]);
  });
});
