/** Instagram's or Facebook's own browser, and the phone it runs on. */
export interface InAppBrowser {
  readonly app: 'instagram' | 'facebook';
  readonly platform: 'iphone' | 'android' | 'other';
}

/**
 * Instagram's or Facebook's in-app browser, by its user agent; null for any other browser. A member who signs in inside one
 * is signed in there alone, so the app opened later in Safari or Chrome finds them signed out (the owner, 15 Nov).
 * Instagram names itself; Facebook's apps (and Messenger) name FBAN or FBAV, and Android's FB_IAB.
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

const CONTINUED_KEY = 'rivr-in-app-browser-continued';

/** Whether the visitor chose Continue here in this browser session. */
export function hasContinuedHere(): boolean {
  try {
    return globalThis.sessionStorage.getItem(CONTINUED_KEY) === 'yes';
  } catch {
    return false;
  }
}

/** Remembers Continue here for this browser session, so sign-in does not ask again. */
export function continueHere(): void {
  try {
    globalThis.sessionStorage.setItem(CONTINUED_KEY, 'yes');
  } catch {
    // Storage refused: the choice holds until the page reloads.
  }
}
