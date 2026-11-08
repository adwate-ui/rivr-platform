/** The banners at the top of Tonight (decision 0320): the only alerts the player app shows inside itself. */
export const playerAlerts = {
  /** The kill switch, in red; it is never dismissed. */
  paused: 'The club is paused. Ask a member of staff.',
  /** Offline on a screen other than Tonight, which names when its tables came. */
  offlineScreen: 'No connection. What you see may be out of date.',
  /** A refresh failed: the screen keeps what it last had. `{time}` is when that came, 22:41. */
  failed: "Couldn't refresh. Showing {time}.",
  offline: 'No connection. Showing tables as of {time}.',
  /** Opened with no connection and nothing kept on the phone (F-053): the screen's name, and what to do. */
  offlineTitle: 'No connection',
  offlineGate: 'Open RIVR again once you are online.',
  retry: 'Try again',
  /** Seated, in the call time's last 15 minutes. */
  callEnding: 'Call time ends in {minutes} min',
  addTime: 'Add time',
} as const;

/** The screen for an address the app does not have. */
export const playerNotFound = {
  title: 'Page not found',
  body: 'The link may be old or mistyped.',
  home: 'Go to Home',
} as const;
