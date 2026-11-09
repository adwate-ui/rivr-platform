/** The console's Activity screen (8 Nov audit, I-75, F-034), for super admins: the audit log in words. */
export const activity = {
  title: 'Activity',
  notAllowed: 'Only a super admin reads the activity log.',
  empty: 'Nothing recorded for this choice.',
  when: 'When',
  who: 'Who',
  kind: 'Kind',
  what: 'What',
  record: 'Record',
  why: 'Why',
  person: 'Person',
  from: 'From',
  to: 'To',
  allKinds: 'All',
  system: 'System',
  unknown: 'No longer on record',
  showEarlier: 'Show earlier',
  recordOf: '{thing} · {name}',
  /** Points or bonus chips by hand: `Gave points: 500`, `Gave bonus chips: 1,500`. */
  withAmount: '{what}: {amount}',
  /** In what an export records, while earlier lines are not loaded. */
  partial: 'Partial: the latest {count} lines only',
  kinds: {
    controls: 'Controls', exports: 'Exports', staff: 'Staff', bonus_chips: 'Bonus chips', points: 'Points', tiers: 'Tiers', members: 'Members',
    settings: 'Settings', floor: 'Floor', other: 'Other',
  },
} as const;

/** What was done, by the audit log's own codes: a change to a row, or a named action. */
const ACTION_WORDS: Readonly<Record<string, string>> = {
  insert: 'Added', update: 'Changed', delete: 'Removed',
  'aml.flag': 'Flagged', 'aml.review': 'Reviewed', 'bonus.give': 'Gave bonus chips',
  'points.grant': 'Gave points', 'points.lock': 'Locked points', 'points.unlock': 'Released points',
  'device.enrolled': 'Enrolled', 'device.enrolment_started': 'Started enrolling', 'device.paired': 'Paired', 'device.pairing_started': 'Started pairing',
  'export.archive_saved': 'Saved an archive', 'export.table': 'Exported', 'export.tally_day': 'Exported', 'export.tds_return': 'Exported',
  'fnb_order.cancel': 'Cancelled', 'kyc_image.view': 'Viewed', 'member.change_phone': 'Changed the mobile number', 'member.erase': 'Erased',
  'practice.reset': 'Reset the practice venue', 'redemption.cancel': 'Cancelled', 'staff.attendance': 'Marked attendance',
  'venue.logo_uploaded': 'Uploaded the logo', 'venue.purge': 'Purged', 'venue.purge_files': 'Purged the files',
};

/** What kind of record it was about, by the audit log's own names. */
const ENTITY_WORDS: Readonly<Record<string, string>> = {
  academy_attendance: 'Academy attendance', academy_batch: 'Academy batch', academy_booking: 'Academy booking', academy_utr_rejection: 'Academy payment refused',
  account_transfer: 'Account transfer', alert: 'Alert', blind_structure: 'Blind structure', bonus_grant: 'Bonus chips given', bonus_redemption: 'Bonus chips used',
  buy_in_request: 'Buy-in request', cab_request: 'Cab request', cage_shift: 'Cage shift', cage_transaction: 'Cage transaction', camera: 'Camera',
  chip_denomination: 'Chip denomination', chip_inventory_count: 'Chip count', chip_inventory_line: 'Chip count line', club_event: 'Event', club_event_booking: 'Event booking',
  consent: 'Consent', contact: 'Contact', control_state: 'Control', creator: 'Creator', credit_line: 'Credit line', dealer_down: 'Dealer down', deposit_request: 'Deposit request',
  device: 'Device', down_count: 'Down count', drill: 'Drill', early_departure: 'Early departure', early_departure_withdrawal: 'Early departure withdrawn', eod_close: 'End of day',
  expense: 'Expense', expense_category: 'Expense category', export_archive: 'Archive', feedback: 'Feedback', fnb_item: 'Menu item', fnb_order: 'Food and drink order', game_table: 'Table',
  glaza_import: 'Glaza import', hand: 'Hand', high_hand_claim: 'High hand claim', incident: 'Incident', invoice: 'Invoice', jackpot_event: 'Jackpot', kyc_image: 'ID photo',
  league_adjustment: 'League adjustment', league_finish: 'League finish', league_season: 'League season', learn_source: 'Learn source', ledger_account: 'Ledger account',
  ledger_transaction: 'Ledger entry', marker: 'Marker', marker_settlement: 'Marker settled', member: 'Member', member_feature_override: 'Member feature', member_limit: 'Member limit',
  member_tier_change: 'Tier change', notice: 'Notice', payment_account: 'Payment account', points_earning: 'Points earned', promotion: 'Promotion', promotion_budget: 'Promotion budget',
  promotion_grant: 'Promotion given', promotion_rule: 'Promotion rule', promotion_step_skip: 'Promotion step skipped', promotion_version: 'Promotion version', purge_request: 'Purge request',
  redemption: 'Redemption', referral: 'Referral', review_request: 'Review request', reward_item: 'Reward', sar_entry: 'AML entry', seat_move: 'Seat move', seat_session: 'Seat',
  second_approval: 'Second approval', self_exclusion: 'Break from play', setting: 'Setting', shareholder: 'Shareholder', shareholding: 'Shareholding', sign_up_attribution: 'Sign-up source',
  site_block: 'Website block', site_page: 'Website page', site_revision: 'Website version', social_post: 'Social post', sop: 'SOP', sop_ack: 'SOP read', sop_version: 'SOP version',
  spin_wheel: 'Spin wheel', staff: 'Staff', staff_attendance: 'Staff attendance', staff_credential: 'Staff PIN', staff_shift: 'Staff shift', storage_object: 'File', table: 'Table',
  table_type: 'Table type', tablet_assignment: 'Tablet assignment', tally_ledger_map: 'Tally mapping', tds_withholding: 'TDS withholding', tier: 'Tier', tier_feature: 'Tier feature',
  tournament: 'Tournament', tournament_entry: 'Tournament entry', tournament_interest: 'Tournament interest', tournament_payout: 'Tournament payout', tournament_purchase: 'Tournament purchase',
  tournament_template: 'Tournament template', tournament_ticket: 'Tournament ticket', tv_screen: 'TV screen', venue: 'Venue', venue_config: 'Venue setup', visit: 'Visit',
  waitlist_entry: 'Waitlist place', wall_post: 'Wall post', withdrawal_request: 'Withdrawal request',
};

/** An audit row's action in words; a code added later reads as recorded, never as the code. */
export function activityActionWord(action: string): string {
  return ACTION_WORDS[action] ?? 'Recorded';
}

/** The kind of record an audit row is about, in words; a table added later reads as a record, never by its name. */
export function activityEntityWord(entity: string): string {
  return ENTITY_WORDS[entity] ?? 'Record';
}
