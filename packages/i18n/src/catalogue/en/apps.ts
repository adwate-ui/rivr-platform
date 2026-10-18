/**
 * Copy for each app's own screens, one area per app. Lanes add to their app's area as they
 * build screens; a large area moves into its own namespace file.
 */
export const playerApp = {
  tonight: { title: 'Tonight', empty: 'No tables are running.' },
  sessions: { title: 'Sessions', empty: 'No sessions yet.' },
  balance: { title: 'Balance', empty: 'No movements yet.' },
  rewards: { title: 'Rewards', empty: 'No rewards yet.' },
  learn: { title: 'Learn', empty: 'No sources yet.' },
  profile: { title: 'Profile', empty: 'Sign in to see your profile.' },
} as const;

export const consoleApp = {
  liveFloor: { title: 'Live floor', empty: 'No tables are running.' },
} as const;

export const tabletApp = {
  /** The table name in the header before the tablet is assigned to a table. */
  unassignedTable: 'Not assigned',
  handEntry: { title: 'Hand entry', empty: 'This tablet is not assigned to a table.' },
} as const;

export const displayApp = {
  unpaired: 'This screen is not paired.',
} as const;

export const driverApp = {
  pickups: { title: 'Pickups', empty: 'No pickups.' },
} as const;

export const webApp = {
  opening: 'Opens Sunday 15 November.',
} as const;
