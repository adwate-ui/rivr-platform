// Whether the member has typed on sign-in (#1053): until then a reload there loses nothing.
let hasBegunSignIn = false;

/** Called once as the app starts: from the member's first key on sign-in, a reload there would lose what they typed. */
export function watchSignInTyping(): void {
  document.addEventListener('input', () => {
    if (window.location.pathname === '/sign-in') hasBegunSignIn = true;
  }, { capture: true });
}

/**
 * Screens a member leaves the app from mid-step, to fetch a sign-in code from Messages, finish in
 * DigiLocker or pay in a UPI app: a reload there would lose what they typed (F3-16). Sign-in only once
 * they have begun it (#1053).
 */
function isMidStep(path: string): boolean {
  if (path === '/sign-in') return hasBegunSignIn;
  return path === '/balance/deposit' || path === '/kyc' || path.startsWith('/kyc/');
}

// A phone that last opened the app days ago starts on the copy it kept, and went through sign-in and the identity check
// on it, as both are screens left mid-step (the trial run, 13 Nov). For the first minute, until the member touches the
// screen or a key, a reload loses nothing, so a new version is taken as it arrives. A touch counts as much as typing: an
// order or a lesson's answers are built by taps.
const LAUNCH_MS = 60_000;
let launchedAt: number | null = null;
let hasBegun = false;
// The update waiting for its moment, if any, and who is told when that changes: the new-version banner (#1053).
let waiting: (() => void) | null = null;
const listeners = new Set<() => void>();

function setWaiting(take: (() => void) | null) {
  waiting = take;
  for (const listener of listeners) listener();
}

/** Tells `listener` whenever a new version starts or stops waiting; returns the way to stop. */
export function subscribeToWaitingUpdate(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Whether a new version is waiting for its moment. */
export function hasWaitingUpdate(): boolean {
  return waiting !== null;
}

/** Takes the waiting version now: the member pressed Refresh. */
export function takeWaitingUpdate(): void {
  waiting?.();
}

/** Called once as the app starts: from now until the member's first touch or key, for a minute at most, a new version is taken at once. */
export function watchLaunch(): void {
  launchedAt = performance.now();
  const begin = () => { hasBegun = true; };
  document.addEventListener('pointerdown', begin, { capture: true, once: true });
  document.addEventListener('keydown', begin, { capture: true, once: true });
}

const isAtLaunch = () => launchedAt !== null && !hasBegun && performance.now() - launchedAt < LAUNCH_MS;

/**
 * Takes a new version of the app once the page is out of sight (#252): at once if it already is,
 * else the next time the member leaves it. Taking it reloads the page, which would lose a UTR or a
 * sign-in code half typed, so it never happens on a screen they leave mid-step. As the app starts,
 * before the first touch or key, it is taken at once, and on sign-in before anything is typed, even in
 * sight (#1053). One still waiting is taken at the next screen (`takeWaitingUpdateAtNewScreens`), or
 * when the member presses Refresh on its banner.
 */
export function takeUpdateWhenHidden(takeUpdate: () => void): void {
  const isSafe = () => {
    const path = window.location.pathname;
    if (isAtLaunch()) return true;
    if (isMidStep(path)) return false;
    return document.visibilityState === 'hidden' || path === '/sign-in';
  };
  let isTaken = false;
  const take = () => {
    if (isTaken) return;
    isTaken = true;
    document.removeEventListener('visibilitychange', onChange);
    if (waiting === take) setWaiting(null);
    takeUpdate();
  };
  const onChange = () => {
    if (isSafe()) take();
  };
  if (isSafe()) {
    take();
    return;
  }
  setWaiting(take);
  document.addEventListener('visibilitychange', onChange);
}

// How often an app left open asks for a new version: every 10 minutes (#1053; it was every hour).
const CHECK_MS = 10 * 60 * 1000;
// The part of the service worker's registration this needs: the way to ask for a new version.
interface VersionSource {
  update: () => Promise<unknown>;
}
let registration: VersionSource | undefined;

/**
 * Asks the server for a new version now; one found arrives through `onNeedRefresh` (main.tsx). Offline it fails quietly.
 * Sign-in asks when a code is refused (through the route), as a member who fills the code from the message never leaves.
 */
export function checkForNewVersion(): void {
  void registration?.update().catch(() => undefined);
}

/** From the service worker's registration on, asks every 10 minutes and each time the member comes back to the app. */
export function watchForNewVersion(found: VersionSource): void {
  registration = found;
  setInterval(checkForNewVersion, CHECK_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkForNewVersion();
  });
}

// What a new service worker asks the open windows before it takes over sign-in (public/update-sw.js), and this
// version's answer: it takes new versions itself, so the worker leaves it be.
const QUESTION = 'rivr-takes-updates?';
const ANSWER = 'rivr-takes-updates';

/** Answers a new service worker's question (#1053): an app built before #1053 cannot, and is reloaded by the worker on sign-in. */
export function answerNewWorkers(): void {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data === QUESTION && event.source instanceof ServiceWorker) event.source.postMessage(ANSWER);
  });
  navigator.serviceWorker.startMessages();
}

/** The part of the app's router this needs: it says when a new location has been shown. */
interface ScreenChanges {
  subscribe: (event: 'onResolved', heard: (change: { pathChanged: boolean }) => void) => unknown;
}

/**
 * Whenever the member moves to another screen, a version that was waiting is taken: nothing is half done on a screen just
 * opened. Another search on the same screen (a tab, a filter) is not a move.
 */
export function takeWaitingUpdateAtNewScreens(router: ScreenChanges): void {
  router.subscribe('onResolved', (change) => {
    if (change.pathChanged) waiting?.();
  });
}
