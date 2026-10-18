import { err, ok } from '@rivr/contracts';
import type { AdapterFailure } from '../shared/failure.ts';
import { createRecorder, type FakeControls } from '../shared/recorder.ts';
import type { InstagramGraphAdapter, TaggedPost } from './types.ts';

/** The fake Instagram Graph adapter, which a test fills with `addTaggedPost`. */
export type FakeInstagramGraph = InstagramGraphAdapter &
  FakeControls<{ readonly since: Date; readonly limit: number }, AdapterFailure> & {
    /** Adds a post as if someone had tagged RIVR. */
    addTaggedPost(post: TaggedPost): void;
  };

/** Instagram with no tagged posts until a test adds some. */
export function createFakeInstagramGraph(): FakeInstagramGraph {
  const recorder = createRecorder<{ readonly since: Date; readonly limit: number }, AdapterFailure>();
  const posts: TaggedPost[] = [];
  return {
    calls: recorder.calls,
    failNext: (failure) => recorder.failNext(failure),
    addTaggedPost: (post) => void posts.push(post),
    async listTaggedPosts({ since, limit }) {
      const failure = recorder.record({ since, limit });
      if (failure) return err(failure);
      const recent = posts.filter((post) => post.postedAt >= since);
      return ok(recent.sort((a, b) => b.postedAt.getTime() - a.postedAt.getTime()).slice(0, limit));
    },
  };
}
