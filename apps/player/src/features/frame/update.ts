/**
 * Screens a member leaves the app from mid-step, to fetch a sign-in code from Messages, finish in
 * DigiLocker or pay in a UPI app: a reload there would lose what they typed (F3-16).
 */
function isMidStep(path: string): boolean {
  return path === '/sign-in' || path === '/balance/deposit' || path === '/kyc' || path.startsWith('/kyc/') || path.startsWith('/academy/');
}

/**
 * Takes a new version of the app once the page is out of sight (#252): at once if it already is,
 * else the next time the member leaves it. Taking it reloads the page, which would lose a UTR or a
 * sign-in code half typed, so it never happens on a screen they leave mid-step.
 */
export function takeUpdateWhenHidden(takeUpdate: () => void): void {
  const isSafe = () => document.visibilityState === 'hidden' && !isMidStep(window.location.pathname);
  if (isSafe()) {
    takeUpdate();
    return;
  }
  const onChange = () => {
    if (!isSafe()) return;
    document.removeEventListener('visibilitychange', onChange);
    takeUpdate();
  };
  document.addEventListener('visibilitychange', onChange);
}
