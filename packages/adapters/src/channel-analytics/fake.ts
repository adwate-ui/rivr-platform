import { err, ok, type SocialChannel } from '@rivr/contracts';
import type { AdapterFailure } from '../shared/failure.ts';
import { createRecorder, type FakeControls } from '../shared/recorder.ts';
import type { ChannelAnalyticsAdapter } from './types.ts';

/** The fake analytics adapter, whose counts a test sets with `setFollowers`. */
export type FakeChannelAnalytics = ChannelAnalyticsAdapter &
  FakeControls<{ readonly channel: SocialChannel }, AdapterFailure> & {
    /** Sets the count the fake reports for a channel. */
    setFollowers(channel: SocialChannel, followers: number): void;
  };

/** Analytics reporting zero followers on every channel until a test sets a count. */
export function createFakeChannelAnalytics(options: { readonly now?: () => Date } = {}): FakeChannelAnalytics {
  const recorder = createRecorder<{ readonly channel: SocialChannel }, AdapterFailure>();
  const followersByChannel = new Map<SocialChannel, number>();
  const now = options.now ?? (() => new Date());
  return {
    calls: recorder.calls,
    failNext: (failure) => recorder.failNext(failure),
    setFollowers: (channel, followers) => void followersByChannel.set(channel, followers),
    async followerCount({ channel }) {
      const failure = recorder.record({ channel });
      if (failure) return err(failure);
      return ok({ channel, followers: followersByChannel.get(channel) ?? 0, measuredAt: now() });
    },
  };
}
