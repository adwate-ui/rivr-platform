import { pushSubscriptionSchema, WEB_PUSH_PUBLIC_KEY, type PushSubscriptionInput } from '@rivr/contracts';

/** The part of a browser's push subscription the app uses. */
export interface PhoneSubscription {
  readonly endpoint: string;
  toJSON(): unknown;
  unsubscribe(): Promise<boolean>;
}

/** The part of a browser's push manager the app uses. */
export interface PhonePushManager {
  getSubscription(): Promise<PhoneSubscription | null>;
  subscribe(options: { userVisibleOnly: boolean; applicationServerKey: BufferSource }): Promise<PhoneSubscription>;
}

/** What the browser offers the app for push (#139): its service worker's push manager, and the permission. */
export interface PushBrowser {
  readonly pushManager: () => Promise<PhonePushManager>;
  readonly permission: () => NotificationPermission;
  readonly requestPermission: () => Promise<NotificationPermission>;
}

/** The browser's push, or null where it has none: an iPhone's Safari outside the home screen, an old browser. */
export function pushBrowser(): PushBrowser | null {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return null;
  return {
    pushManager: async () => (await navigator.serviceWorker.ready).pushManager,
    permission: () => Notification.permission,
    requestPermission: () => Notification.requestPermission(),
  };
}

/** The club's public key as the push manager takes it: base64url to bytes. */
function applicationServerKey() {
  const base64 = WEB_PUSH_PUBLIC_KEY.replaceAll('-', '+').replaceAll('_', '/');
  return Uint8Array.from(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')), (char) => char.charCodeAt(0));
}

function readable(subscription: PhoneSubscription | null): PushSubscriptionInput | null {
  const parsed = pushSubscriptionSchema.safeParse(subscription?.toJSON());
  return parsed.success ? parsed.data : null;
}

/** This phone's subscription, when it has one the app can save. */
export async function currentSubscription(browser: PushBrowser): Promise<PushSubscriptionInput | null> {
  return readable(await (await browser.pushManager()).getSubscription());
}

/** Asks the member's leave, then subscribes this phone: its subscription, `blocked` without leave, or `failed`. */
export async function subscribePhone(browser: PushBrowser): Promise<PushSubscriptionInput | 'blocked' | 'failed'> {
  if ((await browser.requestPermission()) !== 'granted') return 'blocked';
  const manager = await browser.pushManager();
  const subscription = await manager.subscribe({ userVisibleOnly: true, applicationServerKey: applicationServerKey() }).catch(() => null);
  return readable(subscription) ?? 'failed';
}

/** Unsubscribes this phone: the push address to forget, or null when it had none. */
export async function unsubscribePhone(browser: PushBrowser): Promise<string | null> {
  const subscription = await (await browser.pushManager()).getSubscription();
  if (subscription === null) return null;
  await subscription.unsubscribe();
  return subscription.endpoint;
}

/**
 * On signing out: unsubscribes this phone, if it has push, so it stops showing the member's notifications. Asks the
 * worker already registered, never waiting for one that is not there.
 */
export async function unsubscribeOnSignOut(): Promise<string | null> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return null;
  await subscription.unsubscribe();
  return subscription.endpoint;
}
