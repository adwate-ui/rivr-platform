import type { Result } from '@rivr/contracts';
import type { AdapterFailure } from '../shared/failure.ts';

/** A public Instagram post that tags RIVR, for the social wall. */
export interface TaggedPost {
  readonly id: string;
  readonly username: string;
  readonly caption: string;
  readonly mediaUrl: string;
  readonly mediaKind: 'image' | 'video';
  readonly permalink: string;
  readonly postedAt: Date;
}

/** The Instagram Graph API, for posts that tag RIVR. */
export interface InstagramGraphAdapter {
  /** Tagged posts since a time, newest first, at most `limit`. */
  listTaggedPosts(input: {
    readonly since: Date;
    readonly limit: number;
  }): Promise<Result<readonly TaggedPost[], AdapterFailure>>;
}
