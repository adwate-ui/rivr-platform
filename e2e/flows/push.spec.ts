// Push (#139, #338): a member turns notifications on for her phone in Profile, and switches one kind off. The browser's
// push service is outside the club, so the phone's push manager is stood in for: it hands out a subscription the app saves.
// So is the permission prompt, which a headless browser answers as blocked whatever it was granted.
import { expect, test } from '@playwright/test';
import { signInToPlayer } from '../support/signIn.ts';

test('Push: a member turns notifications on for her phone and switches seat calls off', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Notification, 'permission', { get: () => 'granted' });
    Object.defineProperty(Notification, 'requestPermission', { value: async () => 'granted' });
    const saved = { endpoint: 'https://fcm.googleapis.com/fcm/send/e2e-push-flow', keys: { p256dh: 'BE2ePushFlowP256dhKeyAAAAAAAAAAAA', auth: 'e2ePushFlowAuth' } };
    const subscription = () => ({
      endpoint: saved.endpoint,
      toJSON: () => saved,
      unsubscribe: async () => {
        localStorage.removeItem('e2e-push');
        return true;
      },
    });
    Object.defineProperty(PushManager.prototype, 'subscribe', {
      value: async () => {
        localStorage.setItem('e2e-push', 'on');
        return subscription();
      },
    });
    Object.defineProperty(PushManager.prototype, 'getSubscription', {
      value: async () => (localStorage.getItem('e2e-push') ? subscription() : null),
    });
  });
  await signInToPlayer(page, '9000000638');
  await page.getByRole('link', { name: 'Profile' }).click();
  await expect(page.getByRole('heading', { name: 'Profile', level: 1 })).toBeVisible();
  // The switch waits for the service worker, which a first visit installs.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });

  const phone = page.getByRole('switch', { name: 'Notifications on this phone' });
  await expect(phone).toBeEnabled();
  await expect(phone).not.toBeChecked();
  await phone.click();
  await expect(phone).toBeChecked();
  await page.reload();
  await expect(page.getByRole('switch', { name: 'Notifications on this phone' })).toBeChecked();

  const seatCalls = page.getByRole('switch', { name: 'Seat calls' });
  await expect(seatCalls).toBeChecked();
  await seatCalls.click();
  await expect(seatCalls).not.toBeChecked();
  await page.reload();
  await expect(page.getByRole('switch', { name: 'Seat calls' })).not.toBeChecked();

  await page.getByRole('switch', { name: 'Notifications on this phone' }).click();
  await expect(page.getByRole('switch', { name: 'Notifications on this phone' })).not.toBeChecked();
});
