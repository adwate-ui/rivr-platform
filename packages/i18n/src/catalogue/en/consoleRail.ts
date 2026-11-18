/**
 * The console's left rail: its groups and screens. Console copy, so the player's first load never carries it;
 * the rail's own name stays in `ui.consoleRail`, as the shared shell reads it.
 */
export const rail = {
  /** What a count beside a screen is (audit F-129), read out with the screen's name. */
  counts: {
    requests: { one: '1 request', other: '{count} requests' },
    orders: { one: '1 order', other: '{count} orders' },
    idChecks: { one: '1 ID check', other: '{count} ID checks' },
    tickets: { one: '1 open ticket', other: '{count} open tickets' },
    deletions: { one: '1 deletion request', other: '{count} deletion requests' },
    approvals: { one: '1 awaiting approval', other: '{count} awaiting approval' },
  },
  /** Grouped by the job staff are doing (#602). */
  groups: {
    tonight: 'Tonight',
    players: 'Players',
    marketing: 'Marketing',
    money: 'Money',
    reports: 'Reports',
    team: 'Team',
    admin: 'Admin',
  },
  items: {
    /** Console v3's screens that hold others by tab, and the phone's tab bar (phase 1). */
    door: 'Door',
    content: 'Content',
    tables: 'Tables',
    requests: 'Requests',
    floor: 'Floor',
    lists: 'Lists',
    liveFloor: 'Live floor',
    settings: 'Settings',
    waitlist: 'Waitlist',
    topUps: 'Top-ups',
    checkIn: 'Check-in',
    tournaments: 'Tournaments',
    todaysPlayers: 'Today’s players',
    tablesSetup: 'Tables setup',
    members: 'Members',
    kycReview: 'ID checks',
    promotions: 'Promotions',
    fnb: 'Food and drink',
    website: 'Website',
    app: 'App',
    staff: 'Staff',
    feedback: 'Feedback',
    reports: 'Reports',
    activity: 'Activity',
  },
};
