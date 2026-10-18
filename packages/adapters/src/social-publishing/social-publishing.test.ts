import { SOCIAL_CHANNELS } from '@rivr/contracts';
import { describe, expect, it } from 'vitest';
import { byChannel, createDownloadAndPostTarget, createFakeSocialPublishing, type SocialPost } from './index.ts';

const post: SocialPost = { caption: 'High hand tonight.', media: [{ url: 'https://cdn.rivr.test/card.png', kind: 'image' }] };

describe('fake social publishing', () => {
  it('has one target for every channel', () => {
    const publishing = createFakeSocialPublishing();

    expect(Object.keys(publishing)).toEqual([...SOCIAL_CHANNELS]);
    for (const channel of SOCIAL_CHANNELS) expect(publishing[channel].channel).toBe(channel);
  });

  it('publishes to one channel and records the post on that channel only', async () => {
    const publishing = createFakeSocialPublishing();

    expect(await publishing.instagram.publish(post)).toEqual({
      ok: true,
      value: { kind: 'published', channel: 'instagram', postUrl: 'https://social.invalid/instagram/1' },
    });
    expect(publishing.instagram.calls).toEqual([post]);
    expect(publishing.x.calls).toEqual([]);
  });

  it('fails the next post on a channel when a test scripts it', async () => {
    const publishing = createFakeSocialPublishing();
    publishing.linkedin.failNext({ code: 'rejected', reason: 'caption too long' });

    expect(await publishing.linkedin.publish(post)).toEqual({ ok: false, error: { code: 'rejected', reason: 'caption too long' } });
  });
});

describe('download-and-post target', () => {
  it('tells marketing to download the card and post it by hand', async () => {
    const telegram = createDownloadAndPostTarget('telegram');

    expect(await telegram.publish(post)).toEqual({ ok: true, value: { kind: 'download_and_post', channel: 'telegram' } });
  });
});

describe('byChannel', () => {
  it('builds one value per channel', () => {
    expect(byChannel((channel) => channel.length)).toMatchObject({ x: 1, instagram: 9 });
  });
});
