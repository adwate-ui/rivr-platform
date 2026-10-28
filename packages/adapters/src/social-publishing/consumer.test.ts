import { err, ok, type SocialChannel } from '@rivr/contracts';
import { describe, expect, it } from 'vitest';
import type { ClaimedDelivery } from '../outbox/index.ts';
import { byChannel, createDownloadAndPostTarget, createSocialPublishConsumer, postToSendFrom, type SocialPublishingTarget } from './index.ts';

const POST_ID = '00000000-0000-4000-8000-0000000005a1';
const delivery: ClaimedDelivery = { deliveryId: 'd1', eventId: 'e1', venueId: 'v1', eventType: 'social.post_published', payload: { post_id: POST_ID }, attempts: 1 };

/** A target that answers with `outcome` and records what it was sent. */
function target(channel: SocialChannel, outcome: Awaited<ReturnType<SocialPublishingTarget['publish']>>, sent: string[]): SocialPublishingTarget {
  return { channel, publish: async (post) => { sent.push(`${channel}: ${post.caption} ${post.media[0]?.url ?? ''}`); return outcome; } };
}

function setUp(channels: readonly SocialChannel[], targets: Partial<Record<SocialChannel, SocialPublishingTarget>>) {
  const recorded: [SocialChannel, string | null][] = [];
  const consumer = createSocialPublishConsumer({
    publishing: byChannel((channel) => targets[channel] ?? createDownloadAndPostTarget(channel)),
    find: async (postId) => (postId === POST_ID ? postToSendFrom([{ caption: 'RIVR Sunday', image_path: 'v1/post.jpg', channels }], 'https://abc.supabase.co/storage/v1') : null),
    record: async (_postId, channel, postUrl) => { recorded.push([channel, postUrl]); },
  });
  return { consumer, recorded };
}

describe('the social publishing consumer', () => {
  it('sends each connected channel the post with its public image, and records each link', async () => {
    const sent: string[] = [];
    const { consumer, recorded } = setUp(['instagram', 'telegram'], {
      instagram: target('instagram', ok({ kind: 'published', channel: 'instagram', postUrl: 'https://www.instagram.com/p/C1/' }), sent),
      telegram: target('telegram', ok({ kind: 'published', channel: 'telegram', postUrl: 'https://t.me/rivrclub/42' }), sent),
    });

    expect([consumer.name, consumer.isMessaging, consumer.eventTypes]).toEqual(['social-publish', false, ['social.post_published']]);
    expect(await consumer.deliver(delivery)).toEqual({ ok: true, value: null });
    expect(sent).toEqual([
      'instagram: RIVR Sunday https://abc.supabase.co/storage/v1/object/public/social-media/v1/post.jpg',
      'telegram: RIVR Sunday https://abc.supabase.co/storage/v1/object/public/social-media/v1/post.jpg',
    ]);
    expect(recorded).toEqual([['instagram', 'https://www.instagram.com/p/C1/'], ['telegram', 'https://t.me/rivrclub/42']]);
  });

  it('falls back to download and post for a channel refused or without a live target, and retries one down for now', async () => {
    const sent: string[] = [];
    const { consumer, recorded } = setUp(['facebook', 'instagram', 'telegram'], {
      instagram: target('instagram', err({ code: 'rejected', reason: 'Meta error 9004' }), sent),
      telegram: target('telegram', err({ code: 'unavailable' }), sent),
    });

    expect(await consumer.deliver(delivery)).toEqual({ ok: false, error: { code: 'unavailable' } });
    expect(recorded).toEqual([['facebook', null], ['instagram', null]]);
  });

  it('falls back to download and post on the last attempt, so no channel is left publishing', async () => {
    const sent: string[] = [];
    const { consumer, recorded } = setUp(['telegram'], { telegram: target('telegram', err({ code: 'unavailable' }), sent) });
    expect(await consumer.deliver({ ...delivery, attempts: 10 })).toEqual({ ok: true, value: null });
    expect(recorded).toEqual([['telegram', null]]);
  });

  it('finishes a post with nothing left to send, and rejects an event it cannot read', async () => {
    const { consumer } = setUp([], {});
    expect(await consumer.deliver({ ...delivery, payload: { post_id: '00000000-0000-4000-8000-0000000005a2' } })).toEqual({ ok: true, value: null });
    expect(await consumer.deliver({ ...delivery, payload: {} })).toEqual({ ok: false, error: { code: 'rejected', reason: 'social.post_published payload is not readable' } });
    expect(postToSendFrom([], 'https://abc.supabase.co/storage/v1')).toBeNull();
  });
});
