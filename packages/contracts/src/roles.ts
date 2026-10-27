/**
 * The seven permission roles and what each may do (docs/spec/features-2026-10-14.md,
 * "Roles"). Job titles (dealer, floor supervisor, cashier, host...) are a separate field on
 * staff; access comes only from the role. The `role_permission` table holds this matrix and
 * row-level security checks it; a db test keeps the two equal.
 */

export const STAFF_ROLES = ['super_admin', 'admin', 'cashier', 'dealer', 'marketing', 'host', 'owner_view'] as const;

/** A staff member's permission role. */
export type StaffRole = (typeof STAFF_ROLES)[number];

/** Every permission a role can hold. Lanes add one here, in a migration, and to the matrix below. */
export const PERMISSIONS = [
  'venue.configure', // legal entity, GSTIN, payee, bank, invoice prefix
  'settings.manage', // effective-dated rules: rake, caps, call time, bonuses, limits
  'staff.manage',
  'devices.manage', // enrol and revoke tablets, cage computers, TVs
  'members.read',
  'members.manage',
  'members.override_features', // grant or revoke one feature for one member
  'members.erase', // erase one member's personal data on request, super_admin only (decision 0207)
  'kyc.review',
  'tiers.manage', // tiers and the tier x feature matrix
  'floor.manage', // tables, seating, games
  'waitlist.manage',
  'call_time.override', // let a player leave before call time, with a reason
  'hands.log',
  'cage.transact', // buy-ins and cash-outs
  'cage.second_approve', // second approver above the configured limit
  'markers.issue',
  'markers.manage_limits',
  'withdrawals.approve',
  'ledger.read',
  'eod.review', // give the reason for an end-of-day variance (#45), never on a shift one opened or closed
  'tournaments.manage',
  'promotions.manage',
  'promotions.approve', // approve or refuse a submitted promotion, super_admin only (decision 0244)
  'jackpots.approve', // high hands and jackpot payouts
  'marketing.publish',
  'website.edit',
  'host_queue.manage',
  'fnb.manage',
  'reports.read',
  'dashboards.read',
  'exports.table', // export a filtered console table
  'exports.full', // the full encrypted archive
  'audit.read',
  'control.engage', // the kill switch
  'purge.run', // super_admin only, never grantable to another role
  'sops.manage',
  'sops.acknowledge',
  'incidents.log',
  'aml.review',
  'learn.manage_sources', // upload licensed Learn encodings
  'feedback.manage', // the General Manager's feedback tickets (decision 0165)
  'rewards.manage', // the rewards catalogue and the League's seasons (decisions 0181, 0182)
  'rewards.hand_over', // hand a member what they redeemed (decision 0181)
  'treasury.manage', // payment accounts, transfers, expense categories and approving expenses (decision 0167)
  'shareholding.manage', // the shareholding register, super_admin only (decision 0170)
  'pot_data.read', // every hand by table, dealer, variant and period (decision 0185)
] as const;

/** A permission key. */
export type Permission = (typeof PERMISSIONS)[number];

const EVERY_STAFF_MEMBER: readonly Permission[] = ['sops.acknowledge', 'incidents.log'];

/** Which permissions each role holds. super_admin holds every permission. */
export const ROLE_PERMISSIONS: Readonly<Record<StaffRole, readonly Permission[]>> = {
  super_admin: PERMISSIONS,
  admin: [
    ...EVERY_STAFF_MEMBER, 'settings.manage', 'staff.manage', 'devices.manage', 'members.read', 'members.manage',
    'kyc.review', 'tiers.manage', 'floor.manage', 'waitlist.manage', 'call_time.override', 'cage.second_approve',
    'markers.manage_limits', 'ledger.read', 'eod.review', 'tournaments.manage', 'promotions.manage', 'jackpots.approve',
    'host_queue.manage', 'fnb.manage', 'reports.read', 'exports.table', 'sops.manage', 'aml.review', 'feedback.manage',
    'rewards.manage', 'rewards.hand_over',
    'treasury.manage',
  ],
  cashier: [
    ...EVERY_STAFF_MEMBER, 'members.read', 'cage.transact', 'cage.second_approve', 'markers.issue',
    'withdrawals.approve', 'ledger.read', 'rewards.hand_over',
  ],
  dealer: [...EVERY_STAFF_MEMBER, 'hands.log'],
  marketing: [...EVERY_STAFF_MEMBER, 'promotions.manage', 'marketing.publish', 'website.edit', 'rewards.manage'],
  host: [...EVERY_STAFF_MEMBER, 'members.read', 'waitlist.manage', 'host_queue.manage', 'rewards.hand_over'],
  owner_view: [...EVERY_STAFF_MEMBER, 'reports.read', 'dashboards.read', 'ledger.read', 'audit.read'],
};

/** Permissions only super_admin may ever hold (features-2026-10-14.md, "Purge" and "Exports"). */
export const SUPER_ADMIN_ONLY: readonly Permission[] = [
  'purge.run', 'exports.full', 'control.engage', 'members.override_features', 'venue.configure', 'shareholding.manage',
  'members.erase', 'promotions.approve',
];

