// The social publishing consumer (#586; decision 0281): each post's connected channels (setting
// social.connected_channels) are sent the post through their APIs, and the post's link is recorded. Instagram, Facebook
// and Telegram publish once their secrets are set; a channel connected without its secrets, or refused, falls back to
// download and post. pg_cron runs it every minute (decision 0038); practice-venue posts never reach it.
import { createAdapters } from '@rivr/adapters';
import {
  createFacebookPageTarget, createInstagramTarget, createSocialPublishConsumer, createTelegramTarget, postToSendFrom, type SocialPublishingTarget,
} from '@rivr/adapters/social-publishing';
import type { SocialChannel } from '@rivr/contracts';
import { rpc, serveConsumer } from '../_shared/outbox.ts';

const secret = (name: string) => Deno.env.get(name) ?? '';
const storageUrl = `${secret('SUPABASE_URL')}/storage/v1`;

/** The live targets whose secrets are set; createAdapters makes every other channel download and post. */
function liveTargets(): Partial<Record<SocialChannel, SocialPublishingTarget>> {
  const live: Partial<Record<SocialChannel, SocialPublishingTarget>> = {};
  if (secret('INSTAGRAM_USER_ID') && secret('INSTAGRAM_ACCESS_TOKEN')) {
    live.instagram = createInstagramTarget({ instagramUserId: secret('INSTAGRAM_USER_ID'), accessToken: secret('INSTAGRAM_ACCESS_TOKEN') });
  }
  if (secret('FACEBOOK_PAGE_ID') && secret('FACEBOOK_PAGE_TOKEN')) {
    live.facebook = createFacebookPageTarget({ pageId: secret('FACEBOOK_PAGE_ID'), pageToken: secret('FACEBOOK_PAGE_TOKEN') });
  }
  if (secret('TELEGRAM_BOT_TOKEN') && secret('TELEGRAM_CHANNEL')) {
    live.telegram = createTelegramTarget({ botToken: secret('TELEGRAM_BOT_TOKEN'), chat: secret('TELEGRAM_CHANNEL') });
  }
  return live;
}

const { socialPublishing } = createAdapters({ isPracticeVenue: false, live: { socialPublishing: liveTargets() } });

Deno.serve(serveConsumer(createSocialPublishConsumer({
  publishing: socialPublishing,
  find: async (postId) => postToSendFrom(await rpc('social_post_to_send', { p_post_id: postId }), storageUrl),
  record: async (postId, channel, postUrl) => {
    await rpc('record_social_post_channel', { p_post_id: postId, p_channel: channel, p_post_url: postUrl });
  },
})));
