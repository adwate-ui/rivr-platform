/**
 * TanStack Query keys, one place for all of them. Keys that hold a person's data start with
 * their user id, so signing out and in as someone else never shows the previous person's data.
 */
export const queryKeys = {
  /** The start of every key below: everything cached for the signed-in person. */
  personal: ['user'] as const,
  /** The signed-in member's name and initial. */
  member: (userId: string) => ['user', userId, 'member'] as const,
  /** Every feature's state for the signed-in member. */
  featureAccess: (userId: string) => ['user', userId, 'feature-access'] as const,
  /** Kill-switch controls the signed-in person can see. */
  controlState: (userId: string) => ['user', userId, 'control-state'] as const,
  /** The signed-in member's games, stake, notification choices and marketing consent. */
  preferences: (userId: string) => ['user', userId, 'preferences'] as const,
  /** Everything Academy for the signed-in member: refreshed together after a booking or a payment. */
  academy: (userId: string) => ['user', userId, 'academy'] as const,
  academyBatches: (userId: string) => ['user', userId, 'academy', 'batches'] as const,
  academyBookings: (userId: string) => ['user', userId, 'academy', 'bookings'] as const,
  academyPayment: (userId: string, bookingId: string) => ['user', userId, 'academy', 'payment', bookingId] as const,
  /** The signed-in member's KYC record. */
  kycRecord: (userId: string) => ['user', userId, 'kyc-record'] as const,
  /** A venue's Academy batches and bookings, as staff see them. */
  academyStaff: (userId: string, venueId: string) => ['user', userId, 'academy-staff', venueId] as const,
  /** A venue's identity checks for a KYC reviewer. */
  kycReview: (userId: string, venueId: string) => ['user', userId, 'kyc-review', venueId] as const,
  /** Every search for a check in person at a venue, to refresh them together. */
  kycInPersonSearches: (userId: string, venueId: string) => ['user', userId, 'kyc-in-person', venueId] as const,
  kycInPersonCandidates: (userId: string, venueId: string, search: string) => ['user', userId, 'kyc-in-person', venueId, search] as const,
  /** The venues where the signed-in person is active staff, with their role. */
  staffVenues: (userId: string) => ['user', userId, 'staff-venues'] as const,
  /** A signed URL for one KYC image. */
  kycImageUrl: (userId: string, path: string) => ['user', userId, 'kyc-image-url', path] as const,
  /** Tonight's tables and each game's waitlist length, as a member or staff sees them. */
  floorTables: (userId: string) => ['user', userId, 'floor-tables'] as const,
  /** The signed-in member's waitlist places. */
  myWaitlist: (userId: string) => ['user', userId, 'my-waitlist'] as const,
  /** A venue's waitlists, as the floor sees them. */
  waitlistBoard: (userId: string, venueId: string) => ['user', userId, 'waitlist-board', venueId] as const,
  /** The signed-in dealer tablet and its table. */
  myDevice: (userId: string) => ['user', userId, 'my-device'] as const,
  /** A venue's dealer tablets, for staff who manage devices. */
  dealerTablets: (userId: string, venueId: string) => ['user', userId, 'dealer-tablets', venueId] as const,
  /** A venue's dealers whose PIN the signed-in manager may set. */
  venueDealers: (userId: string, venueId: string) => ['user', userId, 'venue-dealers', venueId] as const,
  /** A venue's table types with their rake now and the changes to come. */
  tableTypeRake: (userId: string, venueId: string) => ['user', userId, 'table-type-rake', venueId] as const,
  /** A venue's jackpot: pools, payout rule and history. */
  jackpot: (userId: string, venueId: string) => ['user', userId, 'jackpot', venueId] as const,
  /** The dealers who can sign in on this tablet. */
  tabletDealers: (userId: string) => ['user', userId, 'tablet-dealers'] as const,
  /** The down at this tablet's table. */
  currentDown: (userId: string, tableId: string) => ['user', userId, 'current-down', tableId] as const,
  /** The tablet's table rules now: rake, drop, variations; kept by table. */
  tableRules: (userId: string, tableId: string) => ['user', userId, 'table-rules', tableId] as const,
  /** The hands of the open down on the tablet, kept by down. */
  downHands: (userId: string, downId: string) => ['user', userId, 'down-hands', downId] as const,
  /** An unpaired TV's code (#49): signed out, so it belongs to no one. */
  tvCode: () => ['tv-code'] as const,
  /** Whether staff have typed in that code yet. */
  tvClaim: (code: string) => ['tv-code', code, 'claim'] as const,
  /** The signed-in TV's name and mode. */
  myTvScreen: (userId: string) => ['user', userId, 'my-tv-screen'] as const,
  /** A venue's TVs, for staff who manage devices. */
  venueTvs: (userId: string, venueId: string) => ['user', userId, 'venue-tvs', venueId] as const,
};
