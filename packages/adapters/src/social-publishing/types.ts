import type { Result, SocialChannel } from '@rivr/contracts';
import type { AdapterFailure } from '../shared/failure.ts';

/** A rendered card or clip to post. */
export interface SocialMedia {
  readonly url: string;
  readonly kind: 'image' | 'video';
}

/** A post: caption plus rendered media. */
export interface SocialPost {
  readonly caption: string;
  readonly media: readonly SocialMedia[];
}

/** Published on the channel, or handed to marketing to download and post by hand. */
export type PublishOutcome =
  | { readonly kind: 'published'; readonly channel: SocialChannel; readonly postUrl: string }
  | { readonly kind: 'download_and_post'; readonly channel: SocialChannel };

/** Publishing to one channel. */
export interface SocialPublishingTarget {
  readonly channel: SocialChannel;
  /** Posts to this channel. */
  publish(post: SocialPost): Promise<Result<PublishOutcome, AdapterFailure>>;
}

/** One target per channel. */
export type SocialPublishing = { readonly [Channel in SocialChannel]: SocialPublishingTarget };
