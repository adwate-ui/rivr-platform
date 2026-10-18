/**
 * Takes a new version of the app once the page is out of sight (#252): at once if it already is,
 * else the next time the member leaves it. Taking it reloads the page, which would lose a UTR or a
 * sign-in code half typed.
 */
export function takeUpdateWhenHidden(takeUpdate: () => void): void {
  if (document.visibilityState === 'hidden') {
    takeUpdate();
    return;
  }
  const onChange = () => {
    if (document.visibilityState !== 'hidden') return;
    document.removeEventListener('visibilitychange', onChange);
    takeUpdate();
  };
  document.addEventListener('visibilitychange', onChange);
}
