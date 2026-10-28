import type { AdapterFailure } from '../shared/failure.ts';
import type { InstagramGraphAdapter, TaggedPost } from './types.ts';

// Instagram gives at most this many tagged posts a request; five minutes of tags is far fewer.
const PULL_LIMIT = 50;

export interface WallPull {
  readonly instagram: InstagramGraphAdapter;
  /** The newest post the venue holds, or a week back. */
  readonly since: () => Promise<Date>;
  /** Records the posts for moderation; the number new. */
  readonly record: (posts: readonly TaggedPost[]) => Promise<number>;
}

/** One pull of the social wall (#157): the posts that tag the club since the newest held, recorded for moderation. */
export async function pullWallPosts({ instagram, since, record }: WallPull): Promise<{ readonly recorded: number } | { readonly failure: AdapterFailure }> {
  const posts = await instagram.listTaggedPosts({ since: await since(), limit: PULL_LIMIT });
  if (!posts.ok) return { failure: posts.error };
  return { recorded: posts.value.length === 0 ? 0 : await record(posts.value) };
}
