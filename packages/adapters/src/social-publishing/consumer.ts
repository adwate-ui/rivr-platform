import { ok, socialChannelSchema, type SocialChannel } from '@rivr/contracts';
import { z } from 'zod';
import { MAX_ATTEMPTS, type Consumer } from '../outbox/index.ts';
import type { AdapterFailure } from '../shared/failure.ts';
import type { SocialPublishing } from './types.ts';

/** The event a post with a connected channel sends (#586). */
export const SOCIAL_PUBLISH_EVENT_TYPES = ['social.post_published'] as const;

/** What to send: the caption, the image's public address and the channels still sending. */
export interface PostToSend {
  readonly caption: string;
  readonly imageUrl: string;
  readonly channels: readonly SocialChannel[];
}

export type FindPostToSend = (postId: string) => Promise<PostToSend | null>;
/** Records a channel's outcome: published with its link, or (null) to download and post. */
export type RecordPostChannel = (postId: string, channel: SocialChannel, postUrl: string | null) => Promise<void>;

const publishedSchema = z.object({ post_id: z.uuid() });
const toSendRows = z.array(z.object({ caption: z.string(), image_path: z.string(), channels: z.array(socialChannelSchema) }));

/** social_post_to_send's answer, with the image's public address in the social-media bucket, or null when nothing is left. */
export function postToSendFrom(rows: unknown, storageUrl: string): PostToSend | null {
  const row = toSendRows.parse(rows)[0];
  return row === undefined ? null : { caption: row.caption, imageUrl: `${storageUrl}/object/public/social-media/${row.image_path}`, channels: row.channels };
}

/**
 * The social publishing consumer (#586; decision 0281): each connected channel of a post is sent it through its target and
 * records the post's link. A channel refused, or with no live target after all (download and post), falls back to
 * download and post; one that failed for now is tried again with the delivery, while those already done are not, and
 * on the last attempt falls back too, so no channel is left publishing.
 */
export function createSocialPublishConsumer({ publishing, find, record }: {
  publishing: SocialPublishing;
  find: FindPostToSend;
  record: RecordPostChannel;
}): Consumer {
  return {
    name: 'social-publish',
    eventTypes: SOCIAL_PUBLISH_EVENT_TYPES,
    isMessaging: false,
    async deliver(delivery) {
      const event = publishedSchema.safeParse(delivery.payload);
      if (!event.success) return { ok: false, error: { code: 'rejected', reason: 'social.post_published payload is not readable' } };
      const post = await find(event.data.post_id);
      if (post === null) return ok(null);
      let failure: AdapterFailure | null = null;
      for (const channel of post.channels) {
        const outcome = await publishing[channel].publish({ caption: post.caption, media: [{ url: post.imageUrl, kind: 'image' }] });
        if (outcome.ok) await record(event.data.post_id, channel, outcome.value.kind === 'published' ? outcome.value.postUrl : null);
        else if (outcome.error.code === 'rejected' || delivery.attempts >= MAX_ATTEMPTS) await record(event.data.post_id, channel, null);
        else failure = outcome.error;
      }
      return failure === null ? ok(null) : { ok: false, error: failure };
    },
  };
}
