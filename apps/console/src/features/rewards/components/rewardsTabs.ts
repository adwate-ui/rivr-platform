/**
 * Rewards' parts (console v3), each with its own address inside the Rewards tab: `/rewards?tab=rewards&part=handover`.
 * The spin wheel is the screen's other tab, a screen of its own.
 */
export const REWARDS_PARTS = ['catalogue', 'handover', 'points'] as const;
export type RewardsPart = (typeof REWARDS_PARTS)[number];

/** What a staff member may do here, from their permissions. */
export interface RewardsAccess {
  /** rewards.manage: add and change rewards. */
  readonly keep: boolean;
  /** rewards.hand_over: hand a redemption over, or cancel it. */
  readonly handOver: boolean;
  /** points.give: points by hand and League points. */
  readonly give: boolean;
}

/** The access a staff member's permissions give. */
export function accessOf(permissions: readonly string[]): RewardsAccess {
  return {
    keep: permissions.includes('rewards.manage'),
    handOver: permissions.includes('rewards.hand_over'),
    give: permissions.includes('points.give'),
  };
}

/** The parts a staff member sees: the catalogue for anyone with a rewards permission, then each part their role allows. */
export function partsFor(access: RewardsAccess): readonly RewardsPart[] {
  const shown: Record<RewardsPart, boolean> = {
    catalogue: access.keep || access.handOver || access.give,
    handover: access.handOver,
    points: access.give,
  };
  return REWARDS_PARTS.filter((part) => shown[part]);
}

/** A part's address. */
export const partHref = (part: RewardsPart) => `/rewards?tab=rewards&part=${part}`;
