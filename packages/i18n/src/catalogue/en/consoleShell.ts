/**
 * The console's frame around every screen (console v3, phase 1): the header's counts and search, the staff member's menu,
 * the practice venue's stripe, old addresses that moved, and signing out when idle. Read as `console.shell.*`.
 */
export const shell = {
  /** Under the name in the staff member's menu. */
  detail: '{role} · {venue}',
  density: 'Density',
  comfortable: 'Comfortable',
  compact: 'Compact',
  /** The practice venue's stripe across the top, and its way out. */
  backToClub: 'Back to the club',
  /** The header's counts, each a link: "23 seated · 9 waiting · 6 requests". */
  pulse: {
    label: 'Tonight',
    seated: 'seated',
    waiting: 'waiting',
    requests: 'requests',
  },
  /** The keys that work, in the staff member's menu and in buttons' tooltips. */
  keys: {
    search: 'Search',
    close: 'Close',
    slash: '/',
    commandK: 'Ctrl K',
    escape: 'Esc',
  },
  /** The command palette's groups and their muted words. */
  palette: {
    members: 'Members',
    actions: 'Actions',
    screens: 'Screens',
    screen: 'Screen',
    action: 'Action',
    memberNumber: 'No. {number}',
    seat: 'Seat a player',
    addToWaitlist: 'Add to a waitlist',
    checkIn: 'Check a member in',
  },
  /** An old address whose tab is gone, opened on the screen that took its place (#811). */
  moved: {
    rake: 'Rake is no longer on the console.',
    cameras: 'Cameras are no longer on the console.',
    computers: 'Computers are no longer on the console.',
    gamesHistory: 'Games history moved to Reports, Tables.',
  },
  /** On sign-in after the idle lock signed the staff member out (#811). */
  signedOutIdle: 'Signed out after ten idle minutes.',
} as const;
