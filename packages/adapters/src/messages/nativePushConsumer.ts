import { err, ok, type LiveStatusPlatform } from '@rivr/contracts';
import type { LiveStatusAdapter } from '../live-status/types.ts';
import type { Consumer } from '../outbox/index.ts';
import type { AdapterFailure } from '../shared/failure.ts';
import { PUSH_EVENT_TYPES, pushFor } from './pushConsumer.ts';

/** One phone in the native app a push reaches (#805, decision 0576). */
export interface NativePhone {
  readonly deviceId: string;
  readonly platform: LiveStatusPlatform;
  /** An Android phone's Firebase registration token, or an iPhone's APNs device token. */
  readonly token: string;
}

/** The member's phones in the native app that want this kind of push, under the same rules as FindPushTargets. */
export type FindNativePushTargets = (venueId: string, memberId: string, pushType: string | null, promotionId?: string) => Promise<readonly NativePhone[]>;

/** The events the native push consumer sends: every push but the seat call, which the live status already sounds. */
export const NATIVE_PUSH_EVENT_TYPES = PUSH_EVENT_TYPES.filter((type) => type !== 'waitlist.called');

/** Keeps a failure worth trying again over one that is not, so one refused phone does not end the delivery for the others. */
const worse = (kept: AdapterFailure | null, next: AdapterFailure): AdapterFailure => (kept === null || kept.code === 'rejected' ? next : kept);

/**
 * The pushes for phones in the native app, whose web view has no web push (#805, decision 0576). A consumer of its own beside the
 * web push consumer, so a retry here never sends a web push again. A phone the service no longer knows is forgotten, and a kind of
 * phone without credentials is skipped. A messaging consumer, so a messaging stop holds it; practice-venue events never reach it.
 */
export function createNativePushConsumer({ alerts, findTargets, forget, now = () => new Date() }: {
  alerts: Pick<LiveStatusAdapter, 'alert'>;
  findTargets: FindNativePushTargets;
  /** Forgets a phone's alert token that the push service no longer knows. */
  forget: (deviceId: string) => Promise<void>;
  /** For tests; the clock by default. */
  now?: () => Date;
}): Consumer {
  return {
    name: 'native_push',
    eventTypes: NATIVE_PUSH_EVENT_TYPES,
    isMessaging: true,
    async deliver(delivery) {
      const built = pushFor(delivery, now());
      if (!built.ok || built.value === null) return built;
      const { memberId, pushType, promotionId, title, body, url, tag } = built.value;
      const phones = await findTargets(delivery.venueId, memberId, pushType, promotionId);
      const sends = await Promise.all(phones.map(async (phone) => ({
        phone, sent: await alerts.alert({ id: delivery.eventId, platform: phone.platform, token: phone.token, title, body, url, tag }),
      })));
      let failure: AdapterFailure | null = null;
      for (const { phone, sent } of sends) {
        if (sent.ok || sent.error.code === 'not_configured') continue;
        if (sent.error.code === 'device_gone') await forget(phone.deviceId);
        else failure = worse(failure, sent.error);
      }
      return failure === null ? ok(null) : err(failure);
    },
  };
}
