import webpush from 'web-push';
import { describe, expect, it } from 'vitest';
import { createWebPush } from './index.ts';

const subscription = { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh: 'BKabirP256dhKeyAAAAAAAAAAAA', auth: 'kabirAuth123' } };
const notification = { subscription, title: 'Your seat is ready', body: 'Table 3, seat 9. Hold until 00:30.', url: '/', tag: 'seat-ready' };
const keys = { publicKey: 'public', privateKey: 'private', subject: 'https://app.rivr.test' };

function refusedWith(status: number): typeof webpush.sendNotification {
  return async () => {
    throw new webpush.WebPushError('Refused', status, {}, '', subscription.endpoint);
  };
}

describe('web push', () => {
  it('sends the notification to the subscription, signed with the club key, kept an hour', async () => {
    const sent: unknown[] = [];
    const push = createWebPush({
      ...keys,
      sendNotification: async (...call) => {
        sent.push(call);
        return { statusCode: 201, body: '', headers: { location: 'https://fcm.googleapis.com/fcm/send/m/1' } };
      },
    });

    expect(await push.send(notification)).toEqual({ ok: true, value: { id: 'https://fcm.googleapis.com/fcm/send/m/1' } });
    expect(sent).toEqual([[
      subscription,
      JSON.stringify({ title: 'Your seat is ready', body: 'Table 3, seat 9. Hold until 00:30.', url: '/', tag: 'seat-ready' }),
      { vapidDetails: { subject: 'https://app.rivr.test', publicKey: 'public', privateKey: 'private' }, TTL: 3600, urgency: 'high', timeout: 3_000 },
    ]]);
  });

  it('says a subscription is gone when the push service has dropped it', async () => {
    for (const status of [404, 410]) {
      expect(await createWebPush({ ...keys, sendNotification: refusedWith(status) }).send(notification)).toEqual({ ok: false, error: { code: 'subscription_gone' } });
    }
  });

  it('tells a limit and a refused request from an outage', async () => {
    expect(await createWebPush({ ...keys, sendNotification: refusedWith(429) }).send(notification)).toEqual({ ok: false, error: { code: 'rate_limited' } });
    expect(await createWebPush({ ...keys, sendNotification: refusedWith(400) }).send(notification))
      .toEqual({ ok: false, error: { code: 'rejected', reason: 'push service answered 400' } });
    expect(await createWebPush({ ...keys, sendNotification: refusedWith(503) }).send(notification)).toEqual({ ok: false, error: { code: 'unavailable' } });
    const offline = createWebPush({ ...keys, sendNotification: async () => { throw new Error('getaddrinfo ENOTFOUND'); } });
    expect(await offline.send(notification)).toEqual({ ok: false, error: { code: 'unavailable' } });
  });
});
