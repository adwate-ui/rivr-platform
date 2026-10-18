/**
 * TanStack Query keys, one place for all of them. Keys that hold a person's data start with
 * their user id, so signing out and in as someone else never shows the previous person's data.
 */
export const queryKeys = {
  /** Every feature's state for the signed-in member. */
  featureAccess: (userId: string) => ['user', userId, 'feature-access'] as const,
  /** Kill-switch controls the signed-in person can see. */
  controlState: (userId: string) => ['user', userId, 'control-state'] as const,
};
