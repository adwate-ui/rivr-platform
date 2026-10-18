import { err, ok, type SocialChannel } from '@rivr/contracts';
import type { AdapterFailure } from '../shared/failure.ts';
import { createRecorder, type FakeControls } from '../shared/recorder.ts';
import { byChannel } from './by-channel.ts';
import type { SocialPost, SocialPublishingTarget } from './types.ts';

/** A fake channel target with its own call log and failure script. */
export type FakeSocialTarget = SocialPublishingTarget & FakeControls<SocialPost, AdapterFailure>;

/** A channel that publishes nothing and answers with a post URL that never resolves. */
export function createFakeSocialTarget(channel: SocialChannel): FakeSocialTarget {
  const recorder = createRecorder<SocialPost, AdapterFailure>();
  return {
    channel,
    calls: recorder.calls,
    failNext: (failure) => recorder.failNext(failure),
    async publish(post) {
      const failure = recorder.record(post);
      if (failure) return err(failure);
      return ok({ kind: 'published', channel, postUrl: `https://social.invalid/${channel}/${recorder.calls.length}` });
    },
  };
}

/** A fake target for every channel. */
export function createFakeSocialPublishing(): { readonly [Channel in SocialChannel]: FakeSocialTarget } {
  return byChannel(createFakeSocialTarget);
}
