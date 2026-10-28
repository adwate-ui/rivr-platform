export type { PublishOutcome, SocialMedia, SocialPost, SocialPublishing, SocialPublishingTarget } from './types.ts';
export { byChannel } from './by-channel.ts';
export { createDownloadAndPostTarget } from './download-and-post.ts';
export { createFakeSocialPublishing, createFakeSocialTarget, type FakeSocialTarget } from './fake.ts';
export { createFacebookPageTarget, createInstagramTarget, createTelegramTarget } from './live.ts';
export {
  createSocialPublishConsumer, postToSendFrom, SOCIAL_PUBLISH_EVENT_TYPES, type FindPostToSend, type PostToSend, type RecordPostChannel,
} from './consumer.ts';
