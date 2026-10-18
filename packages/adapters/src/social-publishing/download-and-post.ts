import { ok, type SocialChannel } from '@rivr/contracts';
import type { SocialPublishingTarget } from './types.ts';

/**
 * The target for a channel without credentials: nothing is sent, and the console offers the
 * rendered card for marketing to download and post by hand.
 */
export function createDownloadAndPostTarget(channel: SocialChannel): SocialPublishingTarget {
  return {
    channel,
    publish: async () => ok({ kind: 'download_and_post', channel }),
  };
}
