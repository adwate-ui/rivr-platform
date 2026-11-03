import { err } from '@rivr/contracts';
import type { LiveStatusAdapter } from './types.ts';

/**
 * One live status over both kinds of phone: an iPhone's goes to `ios` (Apple's push service), an Android phone's to
 * `android` (Firebase). A kind of phone whose credentials are not set is `not_configured`.
 */
export function createLiveStatus({ ios, android }: { ios?: LiveStatusAdapter; android?: LiveStatusAdapter }): LiveStatusAdapter {
  return {
    async show(input) {
      const adapter = input.device.platform === 'ios' ? ios : android;
      return adapter === undefined ? err({ code: 'not_configured' }) : adapter.show(input);
    },
  };
}
