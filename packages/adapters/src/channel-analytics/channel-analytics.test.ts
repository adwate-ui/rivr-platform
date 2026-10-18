import { describe, expect, it } from 'vitest';
import { createFakeChannelAnalytics } from './index.ts';

const now = new Date('2026-11-17T06:00:00Z');

describe('fake channel analytics', () => {
  it('reports the follower count set for a channel, measured now', async () => {
    const analytics = createFakeChannelAnalytics({ now: () => now });
    analytics.setFollowers('instagram', 4_210);

    expect(await analytics.followerCount({ channel: 'instagram' })).toEqual({
      ok: true,
      value: { channel: 'instagram', followers: 4_210, measuredAt: now },
    });
  });

  it('reports zero for a channel nobody set', async () => {
    const analytics = createFakeChannelAnalytics({ now: () => now });

    expect(await analytics.followerCount({ channel: 'youtube' })).toMatchObject({ value: { followers: 0 } });
  });

  it('fails the next call when a test scripts it', async () => {
    const analytics = createFakeChannelAnalytics();
    analytics.failNext({ code: 'unavailable' });

    expect(await analytics.followerCount({ channel: 'x' })).toEqual({ ok: false, error: { code: 'unavailable' } });
    expect(analytics.calls).toEqual([{ channel: 'x' }]);
  });
});
