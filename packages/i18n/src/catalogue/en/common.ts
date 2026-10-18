/** Copy shared by every surface: states every screen has. */
export const common = {
  loading: 'Loading',
  retry: 'Try again',
  loadFailed: 'Could not load this. Check the connection and try again.',
  offline: 'Offline.',
  close: 'Close',
  cancel: 'Cancel',
  confirm: 'Confirm',
  back: 'Back',
  /** The heading over notFound. */
  notFoundTitle: 'Page not found',
  notFound: 'This page does not exist.',
  /** LockedNotice: a feature this member's tier does not have. `{tiers}` is a formatted list. */
  featureLocked: '{tiers} only.',
} as const;
