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
};
