/**
 * The permission roles and what each may do (docs/spec/features-2026-10-14.md,
 * "Roles"). Job titles (dealer, floor supervisor, cashier, host...) are a separate field on
 * staff; access comes only from the role. The `role_permission` table holds this matrix and
 * row-level security checks it; a db test keeps the two equal.
 */

export const STAFF_ROLES = ['super_admin', 'admin', 'cashier', 'dealer', 'marketing', 'host', 'owner_view', 'service', 'floor', 'guest_relations'] as const;

/** A staff member's permission role. */
export type StaffRole = (typeof STAFF_ROLES)[number];

/** Every permission a role can hold. Lanes add one here, in a migration, and to the matrix below. */
export const PERMISSIONS = [
  'venue.configure', // legal entity, GSTIN, payee, bank, invoice prefix
  'settings.manage', // effective-dated rules: rake, caps, call time, bonuses, limits
  'staff.manage',
  'devices.manage', // enrol and revoke tablets, door kiosks and cage computers, and keep the cameras; TVs are tvs.manage
  'tvs.manage', // pair TVs, choose what each shows and unpair one: no other device (the owner, 3 Nov)
  'members.read',
  'members.manage',
  'members.override_features', // grant or revoke one feature for one member
  'members.erase', // erase one member's personal data on request, super_admin only (decision 0207)
  'members.change_phone', // change a member's phone number, their login, super_admin only (decision 0248)
  'members.phone', // see members' mobile numbers on the Door and Members and open their History: floor and up (decision 0690) and cashiers (decision 0709)
  'members.referrer', // set the member who referred a member, paid as a code typed at sign-up: floor and up (the owner, 25 Nov)
  'visits.add', // add a past visit to a member's record: floor and up, a super admin's at once, anyone else's once a super admin approves it (the owner, 25 Nov)
  'kyc.review',
  'kyc.in_person', // check a member in person at the desk: hosts and the floor too (decision 0301)
  'tiers.manage', // tiers and the tier x feature matrix
  'floor.manage', // tables, seating, games
  'tables.manage', // the stakes and tables the club runs, and games history (#642, #643): admins and the floor (the owner, 25 Nov)
  'waitlist.manage',
  'call_time.override', // let a player leave before call time, with a reason
  'hands.log',
  'cage.transact', // buy-ins and cash-outs
  'cage.second_approve', // second approver above the configured limit
  'ledger.read',
  'tournaments.manage',
  'promotions.manage',
  'promotions.approve', // approve or refuse a submitted promotion, super_admin only (decision 0244)
  'website.edit',
  'host_queue.manage',
  'fnb.manage',
  'fnb.serve', // the menu, tonight's orders, accepting and delivering them: never a comp, nor Glaza's statement (#640)
  'reports.read',
  'dashboards.read',
  'exports.table', // export a filtered console table
  'exports.full', // the full encrypted archive
  'audit.read',
  'activity.read', // the Activity screen: what staff did and when, super_admin only as before the kill switch went (#951)
  'sops.manage',
  'aml.review',
  'feedback.manage', // the General Manager's feedback tickets (decision 0165)
  'bonus.give', // add bonus chips to a member by hand and use them without a seat, never one's own: super admins, admins, floor managers and cashiers (the owner, 9 and 22 Nov)
  'bonus.correct', // reverse any Bonus given and add a use a seat missed: super admins and cashiers (the owner, 22 Nov; decision 0709)
  'treasury.manage', // payment accounts, transfers, expense categories and approving expenses (decision 0167)
  'top_ups.manage', // top-up requests and nothing else: guest relations' whole role (redesign RD-32); admins hold it to give the role
] as const;

/** A permission key. */
export type Permission = (typeof PERMISSIONS)[number];


/** Which permissions each role holds. super_admin holds every permission. */
export const ROLE_PERMISSIONS: Readonly<Record<StaffRole, readonly Permission[]>> = {
  super_admin: PERMISSIONS,
  admin: [
    'settings.manage', 'staff.manage', 'devices.manage', 'tvs.manage', 'members.read', 'members.manage', 'members.phone', 'members.referrer', 'visits.add',
    'kyc.review', 'kyc.in_person', 'tiers.manage', 'floor.manage', 'waitlist.manage', 'call_time.override', 'cage.second_approve',
    'ledger.read', 'tournaments.manage', 'promotions.manage',
    'host_queue.manage', 'fnb.manage', 'fnb.serve', 'reports.read', 'exports.table', 'sops.manage', 'aml.review', 'feedback.manage',
    'treasury.manage', 'tables.manage', 'bonus.give', 'top_ups.manage',
  ],
  // Every super admin module but the member list, tournaments and bonus (#644); TVs through a permission of their own, as
  // devices.manage reaches the cage's computers and the cameras. Bonus chips by hand came later (the owner, 9 Nov), and tables
  // setup with stakes and games history, which tables.manage opens (the owner, 25 Nov).
  floor: [
    'members.read', 'members.phone', 'waitlist.manage', 'floor.manage', 'call_time.override', 'fnb.serve', 'bonus.give', 'kyc.in_person', 'tvs.manage',
    'members.referrer', 'visits.add', 'tables.manage',
  ],
  // The floor's modules less the food and drink orders (#644), beside the cage's (hidden, decision 0284); all of Members to
  // view and the Bonus: added, used, a missed use added and reversed (the owner, 22 Nov; decision 0709).
  cashier: [
    'members.read', 'members.phone', 'cage.transact', 'cage.second_approve',
    'ledger.read', 'waitlist.manage', 'floor.manage', 'call_time.override', 'tvs.manage', 'bonus.give', 'bonus.correct',
  ],
  dealer: ['hands.log'],
  marketing: ['promotions.manage', 'website.edit'],
  host: ['members.read', 'waitlist.manage', 'host_queue.manage', 'kyc.in_person'],
  // No Reports for investors (the owner, 9 Nov).
  owner_view: ['dashboards.read', 'ledger.read', 'audit.read'],
  // Food and drink only: the menu and the orders, with no comp nor Glaza's statement (#640).
  service: ['fnb.serve'],
  // Top-up requests only (redesign RD-32; the owner, 15 Nov): to accept one, mark it done and read who did and how long each step took.
  guest_relations: ['top_ups.manage'],
};

/** Permissions only super_admin may ever hold (features-2026-10-14.md, "Exports"). */
export const SUPER_ADMIN_ONLY: readonly Permission[] = [
  'exports.full', 'activity.read', 'members.override_features', 'venue.configure',
  'members.erase', 'promotions.approve', 'members.change_phone',
];

