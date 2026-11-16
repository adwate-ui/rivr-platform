/** Instagram's or Facebook's own browser, and the phone it runs on. */
export interface InAppBrowser {
  readonly app: 'instagram' | 'facebook';
  readonly platform: 'iphone' | 'android' | 'other';
}

/**
 * Instagram's or Facebook's in-app browser, by its user agent; null for any other browser. A member who signs in inside one
 * is signed in there alone, so the app opened later in Safari or Chrome finds them signed out (the owner, 15 Nov), and on an
 * iPhone it refuses the camera (#1050). Instagram names itself; Facebook's apps (and Messenger) name FBAN or FBAV, and
 * Android's FB_IAB.
 */
export function inAppBrowserOf(userAgent: string): InAppBrowser | null {
  const app = /\bInstagram\b/.test(userAgent) ? 'instagram' : /FBAN|FBAV|FB_IAB/.test(userAgent) ? 'facebook' : null;
  if (app === null) return null;
  const platform = /iPhone|iPad|iPod/.test(userAgent) ? 'iphone' : /Android/.test(userAgent) ? 'android' : 'other';
  return { app, platform };
}

/** An Android link that opens `url` in Chrome itself, or in the phone's browser where Chrome is not installed. */
export function chromeIntentOf(url: string): string {
  const { host, pathname, search, hash } = new URL(url);
  return `intent://${host}${pathname}${search}${hash}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url)};end`;
}
