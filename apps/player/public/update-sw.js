// Brings a new version to the phones that cannot take it themselves (#1053), loaded by Workbox's service worker
// (vite.config.ts). An app built before #1053 never takes a new version on sign-in once the member has touched the screen,
// so a member whose app predates the move to SMS codes (#1043) could stay on the old sign-in for good. On an update (an
// older worker is active), when every open window is on sign-in and none answers that it takes new versions itself
// (update.ts answers), this worker takes over at once. Any other open screen, such as a deposit or an ID check, keeps the
// update waiting for the app, as before. Whenever it takes over, by that or any other way, it asks the sign-in windows
// again and reloads those that do not answer: so nothing hangs on a decision kept in memory, which the browser may drop.
const SIGN_IN = '/sign-in';
const QUESTION = 'rivr-takes-updates?';
const ANSWER = 'rivr-takes-updates';
const ANSWER_MS = 2000;

const openWindows = () => self.clients.matchAll({ type: 'window', includeUncontrolled: true });
const isOnSignIn = (client) => new URL(client.url).pathname === SIGN_IN;

/**
 * The ids of the windows that answer within two seconds: versions that take new versions themselves. Done as soon as
 * every window has answered, so a page that takes the version itself is not kept waiting.
 */
function answeringIds(clients) {
  return new Promise((resolve) => {
    const ids = new Set();
    let timer;
    const done = () => {
      clearTimeout(timer);
      self.removeEventListener('message', onMessage);
      resolve(ids);
    };
    const onMessage = (event) => {
      if (event.data === ANSWER && event.source) ids.add(event.source.id);
      if (ids.size === clients.length) done();
    };
    self.addEventListener('message', onMessage);
    timer = setTimeout(done, ANSWER_MS);
    for (const client of clients) client.postMessage(QUESTION);
  });
}

async function shouldTakeOverSignIn() {
  // The first version already serves the page that installed it.
  if (!self.registration.active) return false;
  const clients = await openWindows();
  if (clients.length === 0 || !clients.every((client) => isOnSignIn(client) && typeof client.navigate === 'function')) return false;
  const answered = await answeringIds(clients);
  return clients.every((client) => !answered.has(client.id));
}

/** The sign-in windows of an app too old to take a new version itself, reloaded. A window is sent only once claimed. */
async function reloadOldSignIn() {
  const clients = (await openWindows()).filter((client) => isOnSignIn(client) && typeof client.navigate === 'function');
  if (clients.length === 0) return;
  const answered = await answeringIds(clients);
  const old = clients.filter((client) => !answered.has(client.id));
  if (old.length === 0) return;
  await self.clients.claim();
  await Promise.all(old.map((client) => client.navigate(client.url).catch(() => null)));
}

self.addEventListener('install', (event) => {
  event.waitUntil(shouldTakeOverSignIn().then((takesOver) => (takesOver ? self.skipWaiting() : undefined)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(reloadOldSignIn());
});
