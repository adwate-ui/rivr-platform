/** Rewards' parts, each its own tab with its own address (`/rewards?tab=spin`), in the rail's order (console v3). */
export const REWARDS_TABS = ['catalogue', 'handover', 'points', 'spin'] as const;
export type RewardsTab = (typeof REWARDS_TABS)[number];

/** What a staff member may do here, from their permissions. */
export interface RewardsAccess {
  /** rewards.manage: add and change rewards. */
  readonly keep: boolean;
  /** rewards.hand_over: hand a redemption over, or cancel it. */
  readonly handOver: boolean;
  /** points.give: points by hand and League points. */
  readonly give: boolean;
  /** promotions.manage: spin the wheel and keep its prizes, as the database asks (decision 0302). */
  readonly spin: boolean;
}

/** The access a staff member's permissions give. */
export function accessOf(permissions: readonly string[]): RewardsAccess {
  return {
    keep: permissions.includes('rewards.manage'),
    handOver: permissions.includes('rewards.hand_over'),
    give: permissions.includes('points.give'),
    spin: permissions.includes('promotions.manage'),
  };
}

/** The tabs a staff member sees: the catalogue for anyone with a rewards permission, then each part their role allows. */
export function tabsFor(access: RewardsAccess): readonly RewardsTab[] {
  const shown: Record<RewardsTab, boolean> = {
    catalogue: access.keep || access.handOver || access.give,
    handover: access.handOver,
    points: access.give,
    spin: access.spin,
  };
  return REWARDS_TABS.filter((tab) => shown[tab]);
}
