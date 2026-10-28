import { WEB_PUSH_PUBLIC_KEY } from '@rivr/contracts';
import { describe, expect, it } from 'vitest';
import { currentSubscription, subscribePhone, unsubscribePhone, type PhonePushManager, type PhoneSubscription, type PushBrowser } from './phonePush.ts';

const saved = { endpoint: 'https://fcm.googleapis.com/fcm/send/kabir', keys: { p256dh: 'BKabirP256dhKeyAAAAAAAAAAAA', auth: 'kabirAuth123' } };

/** A browser whose push manager holds one subscription or none, and answers the permission prompt as told. */
function browserWith({ isSubscribed = false, answer = 'granted' }: { isSubscribed?: boolean; answer?: NotificationPermission } = {}) {
  let current: PhoneSubscription | null = null;
  const made = (): PhoneSubscription => ({
    endpoint: saved.endpoint,
    toJSON: () => saved,
    unsubscribe: async () => {
      current = null;
      return true;
    },
  });
  if (isSubscribed) current = made();
  const options: unknown[] = [];
  const manager: PhonePushManager = {
    getSubscription: async () => current,
    subscribe: async (given) => {
      options.push(given);
      current = made();
      return current;
    },
  };
  const browser: PushBrowser = { pushManager: async () => manager, permission: () => 'default', requestPermission: async () => answer };
  return { browser, options, isSubscribed: () => current !== null };
}

describe('push on this phone', () => {
  it('finds the phone\u2019s subscription, or none', async () => {
    expect(await currentSubscription(browserWith({ isSubscribed: true }).browser)).toEqual(saved);
    expect(await currentSubscription(browserWith().browser)).toBeNull();
  });

  it('subscribes with the club key once the member allows notifications', async () => {
    const phone = browserWith();
    expect(await subscribePhone(phone.browser)).toEqual(saved);
    const [given] = phone.options;
    expect(given).toMatchObject({ userVisibleOnly: true });
    const key = Reflect.get(Object(given), 'applicationServerKey');
    expect(btoa(String.fromCharCode(...Array.from(key instanceof Uint8Array ? key : []))).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, ''))
      .toBe(WEB_PUSH_PUBLIC_KEY);
  });

  it('is blocked when the member does not allow notifications, and subscribes nothing', async () => {
    const phone = browserWith({ answer: 'denied' });
    expect(await subscribePhone(phone.browser)).toBe('blocked');
    expect(phone.isSubscribed()).toBe(false);
  });

  it('unsubscribes the phone, giving the address to forget', async () => {
    const phone = browserWith({ isSubscribed: true });
    expect(await unsubscribePhone(phone.browser)).toBe(saved.endpoint);
    expect(phone.isSubscribed()).toBe(false);
    expect(await unsubscribePhone(phone.browser)).toBeNull();
  });
});
