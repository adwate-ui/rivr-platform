/**
 * Screens a member leaves the app from mid-step, to fetch a sign-in code from Messages, finish in
 * DigiLocker or pay in a UPI app: a reload there would lose what they typed (F3-16).
 */
function isMidStep(path: string): boolean {
  return path === '/sign-in' || path === '/balance/deposit' || path === '/kyc' || path.startsWith('/kyc/') || path.startsWith('/academy/');
}

// A phone that last opened the app days ago starts on the copy it kept, and went through sign-in and the identity check
// on it, as both are screens left mid-step (the trial run, 13 Nov). For the first minute, until something is typed, a reload
// loses nothing, so a new version is taken as it arrives.
const LAUNCH_MS = 60_000;
let launchedAt: number | null = null;
let hasTyped = false;
// The update waiting for its moment, if any.
let waiting: (() => void) | null = null;

/** Called once as the app starts: from now until the member first types, for a minute at most, a new version is taken at once. */
export function watchLaunch(): void {
  launchedAt = performance.now();
  document.addEventListener('input', () => { hasTyped = true; }, { capture: true });
}

const isAtLaunch = () => launchedAt !== null && !hasTyped && performance.now() - launchedAt < LAUNCH_MS;

/**
 * Takes a new version of the app once the page is out of sight (#252): at once if it already is,
 * else the next time the member leaves it. Taking it reloads the page, which would lose a UTR or a
 * sign-in code half typed, so it never happens on a screen they leave mid-step. As the app starts,
 * before anything is typed, it is taken at once; and one still waiting is taken at the next screen
 * (`takeWaitingUpdate`).
 */
export function takeUpdateWhenHidden(takeUpdate: () => void): void {
  const isSafe = () => isAtLaunch() || (document.visibilityState === 'hidden' && !isMidStep(window.location.pathname));
  let isTaken = false;
  const take = () => {
    if (isTaken) return;
    isTaken = true;
    document.removeEventListener('visibilitychange', onChange);
    if (waiting === take) waiting = null;
    takeUpdate();
  };
  const onChange = () => {
    if (isSafe()) take();
  };
  if (isSafe()) {
    take();
    return;
  }
  waiting = take;
  document.addEventListener('visibilitychange', onChange);
}

/** The member moved to another screen: nothing is half typed there, so a version that was waiting is taken now. */
export function takeWaitingUpdate(): void {
  waiting?.();
}
