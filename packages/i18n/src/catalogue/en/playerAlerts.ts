/** The banners at the top of Tonight (decision 0320): the only alerts the player app shows inside itself. */
export const playerAlerts = {
  /** The kill switch, in red; it is never dismissed. */
  paused: 'The club is paused. Ask a member of staff.',
  /** A refresh failed: the screen keeps what it last had. `{time}` is when that came, 22:41. */
  failed: "Couldn't refresh. Showing {time}.",
  offline: 'Offline. Showing tables as of {time}.',
  retry: 'Retry',
  /** Seated, in the call time's last 15 minutes. */
  callEnding: 'Call time ends in {minutes} min',
  addTime: 'Add time',
} as const;

/** The 404 screen. */
export const playerNotFound = {
  code: '404',
  title: "This page doesn't exist.",
  body: 'The link may be old or mistyped.',
  home: 'Go to Tonight',
} as const;
