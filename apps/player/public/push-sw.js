// Web push for the installed app (#139; decision 0272), loaded by Workbox's service worker (vite.config.ts): shows each
// notification the push consumer sends, and opens the app's page for it when tapped, never another site's.
self.addEventListener('push', (event) => {
  const message = event.data ? event.data.json() : null;
  if (!message || typeof message.title !== 'string') return;
  event.waitUntil(
    self.registration.showNotification(message.title, {
      body: message.body,
      tag: message.tag,
      data: { url: message.url },
      icon: '/icons/icon-192.png',
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url ?? '/', self.location.origin);
  if (url.origin !== self.location.origin) return;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((window) => 'focus' in window);
      if (!open) return self.clients.openWindow(url.href);
      return open.navigate(url.href).then(() => open.focus());
    }),
  );
});
