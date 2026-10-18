import { describe, expect, it } from 'vitest';
import { createFakePush, type PushNotification } from './index.ts';

const notification: PushNotification = {
  subscription: { endpoint: 'https://push.example.test/abc', keys: { p256dh: 'key', auth: 'secret' } },
  title: 'Your seat is ready.',
  body: 'Table 3, seat 6.',
  url: '/home',
  tag: 'seat-ready',
};

describe('fake web push', () => {
  it('delivers and records the notification', async () => {
    const push = createFakePush();

    expect(await push.send(notification)).toEqual({ ok: true, value: { id: 'fake-push-1' } });
    expect(push.calls).toEqual([notification]);
  });

  it('reports a subscription the browser has dropped, so the caller deletes it', async () => {
    const push = createFakePush();
    push.failNext({ code: 'subscription_gone' });

    expect(await push.send(notification)).toEqual({ ok: false, error: { code: 'subscription_gone' } });
  });
});
