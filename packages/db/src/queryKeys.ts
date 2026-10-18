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
  /** The signed-in member's KYC record. */
  kycRecord: (userId: string) => ['user', userId, 'kyc-record'] as const,
  /** A signed URL for one KYC image. */
  kycImageUrl: (userId: string, path: string) => ['user', userId, 'kyc-image-url', path] as const,
};
