import type { Result } from '@rivr/contracts';
import type { AdapterFailure } from '../shared/failure.ts';

/** A browser's web push subscription, as the PWA's service worker registers it. */
export interface WebPushSubscription {
  readonly endpoint: string;
  readonly keys: { readonly p256dh: string; readonly auth: string };
}

/** One push notification: seat ready, call time complete, withdrawal sent and the like. */
export interface PushNotification {
  readonly subscription: WebPushSubscription;
  readonly title: string;
  readonly body: string;
  /** The app path to open when tapped, `/home`. */
  readonly url: string;
  /** Replaces an earlier notification with the same tag. */
  readonly tag: string;
}

/** Why a push failed: a vendor failure, or a subscription the browser dropped (delete it). */
export type PushFailure = AdapterFailure | { readonly code: 'subscription_gone' };

/** Web push now; native push replaces it in the store builds. */
export interface PushAdapter {
  /** Sends one notification to one subscription. */
  send(notification: PushNotification): Promise<Result<{ readonly id: string }, PushFailure>>;
}
