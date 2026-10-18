/** Copy that @rivr/ui components show themselves: navigation, shells, controls. */
export const ui = {
  brand: {
    /** The letters on the wordmark tiles; not translated. */
    name: 'RIVR',
    /** Letter-spaced beneath the wordmark. */
    tagline: 'Poker club',
    /** The wordmark's accessible name. */
    label: 'RIVR Poker Club',
  },
  playerTabs: {
    /** Accessible name of the player app's bottom tab bar. */
    label: 'Main',
    home: 'Home',
    sessions: 'Sessions',
    balance: 'Balance',
    rewards: 'Rewards',
    learn: 'Learn',
  },
  profile: {
    /** The member's initial, top right, opens Profile. */
    open: 'Profile',
  },
  consoleRail: {
    /** Accessible name of the console's left rail. */
    label: 'Sections',
    groups: {
      floor: 'Floor',
      money: 'Money',
      players: 'Players',
      growth: 'Growth',
      team: 'Team',
      reports: 'Reports',
    },
    items: {
      liveFloor: 'Live floor',
      waitlist: 'Waitlist',
      checkIn: 'Check-in',
      tournaments: 'Tournaments',
      cage: 'Cage',
      markers: 'Markers',
      treasury: 'Treasury',
      endOfDay: 'End of day',
      members: 'Members',
      kycReview: 'KYC review',
      hostQueue: 'Host queue',
      promotions: 'Promotions',
      jackpots: 'Jackpots',
      rewards: 'Rewards',
      academy: 'Academy',
      staff: 'Staff',
      dealers: 'Dealers',
      sops: 'SOPs',
      reports: 'Reports',
    },
  },
  web: {
    /** Accessible name of the public website's main navigation. */
    navigation: 'Site',
  },
} as const;
