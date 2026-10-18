import type { Result, SocialChannel } from '@rivr/contracts';
import type { AdapterFailure } from '../shared/failure.ts';

/** A channel's follower count at a moment. */
export interface FollowerCount {
  readonly channel: SocialChannel;
  readonly followers: number;
  readonly measuredAt: Date;
}

/** Follower counts for every publishing channel. */
export interface ChannelAnalyticsAdapter {
  /** The channel's follower count now. */
  followerCount(input: { readonly channel: SocialChannel }): Promise<Result<FollowerCount, AdapterFailure>>;
}
