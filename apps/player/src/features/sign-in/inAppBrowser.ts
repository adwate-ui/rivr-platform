// Continue here at sign-in, inside Instagram's or Facebook's own browser (`inAppBrowserOf`, @rivr/ui), for the session.
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
