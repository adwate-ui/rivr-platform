import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';

/** The part of the native app's LiveStatus plugin the frame listens to (profile's nativePhone.ts has the rest). */
interface OpenedLinks {
  /** A lock-screen status or its button was tapped: the app page it opens. */
  addListener(event: 'opened', listener: (opened: { path: string }) => void): Promise<PluginListenerHandle>;
}

/** The plugin in the native app; null in a browser, where the push service worker opens a tapped push's page. */
const LIVE_STATUS_LINKS: OpenedLinks | null = Capacitor.isNativePlatform() ? registerPlugin<OpenedLinks>('LiveStatus') : null;

// Only the pages a status opens (decision 0321): Tonight, Tonight answering a seat call, and Order. A link from elsewhere
// that reaches the app's address cannot send it anywhere else.
const NOTIFICATION_PATH = /^\/(\?accept=[0-9a-f-]{36}|fnb)?$/;

/** Calls `open` with each page a lock-screen status opens, in the native app (decision 0361); returns how to stop. */
export function onNotificationOpened(open: (path: string) => void, links = LIVE_STATUS_LINKS): () => void {
  if (links === null) return () => undefined;
  const handle = links.addListener('opened', ({ path }) => {
    if (NOTIFICATION_PATH.test(path)) open(path);
  });
  return () => void handle.then((listener) => listener.remove());
}
