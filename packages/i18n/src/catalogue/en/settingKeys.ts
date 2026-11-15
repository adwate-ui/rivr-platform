import { floorSettingKeys } from './settingKeysFloor.ts';
import { identitySettingKeys } from './settingKeysIdentity.ts';

/**
 * Each setting as staff read it on the Settings screen (#604): its name, one line on what it does (eight words or fewer
 * for a setting the screen groups, redesign RD-18), each field's label,
 * and a choice field's options. Keyed by the setting's key. The console's catalogue test holds it to every key and
 * field the contracts declare, so a new key cannot ship without its words.
 */
export interface SettingCopy {
  readonly name: string;
  readonly help: string;
  readonly fields: Readonly<Record<string, string>>;
  readonly options?: Readonly<Record<string, string>>;
}

export const settingKeys: Readonly<Record<string, SettingCopy>> = {
  ...identitySettingKeys,
  ...floorSettingKeys,
  'alert.thresholds': {
    name: 'Delivery failure alert',
    help: 'The owner is alerted when this many messages fail for good within this many minutes. 5 within 60 minutes unless set.',
    fields: { failed_deliveries: 'Failed messages', window_minutes: 'Within' },
  },
  'aml.structuring': {
    name: 'Structuring pattern',
    help: 'Flags a member whose cash buy-ins end just under the limit this many times within this many days. 3 in 7 days, within 10%, unless set.',
    fields: { count: 'Times', window_days: 'Within', margin_basis_points: 'Under the limit by up to' },
  },
  'cab.minimum_visits': {
    name: 'Cab offer after',
    help: 'Visits this month before a cab home is offered. 4 unless set.',
    fields: { visits: 'Visits this month' },
  },
  'cage.cash_buy_in_limit': {
    name: 'Cash buy-in limits',
    help: 'The most a member may buy in for cash in one visit and in one club day. A cash buy-in past either is refused.',
    fields: { per_visit_paise: 'Per visit', per_day_paise: 'Per club day' },
  },
  'cage.second_approver_threshold': {
    name: 'Second approval from',
    help: 'A withdrawal of this much or more is paid only once a second staff member approves it. A raise takes effect 24 hours after it is made.',
    fields: { threshold_paise: 'Amount' },
  },
  'credit.config': {
    name: 'Credit lines',
    help: 'Who may get credit, and how much: the visits a member needs first, the limit above which a super admin approves, and the most the room may owe in all. A raise of the approval limit takes effect 24 hours after it is made.',
    fields: { minimum_visits: 'Visits needed', approval_threshold_paise: 'Super admin approves above', exposure_cap_paise: 'Most owed in all' },
  },
  'dealer.variance_threshold': {
    name: 'Drop-box variance alert',
    help: "How far a down's drop-box count may differ from the rake and jackpot drops in its hands, either way, before an alert. Not set alerts on any difference.",
    fields: { threshold_paise: 'Difference' },
  },
  'exports.alert_rows': {
    name: 'Large export alert',
    help: 'An export of this many rows or more alerts the owner. 1,000 unless set.',
    fields: { rows: 'Rows' },
  },
  'exports.archive_recipient': {
    name: 'Archive encryption key',
    help: "The public key a full export archive is encrypted to: the owner's backup key. No archive is made until it is set.",
    fields: { recipient: 'Public key' },
  },
  'gst.config': {
    name: 'GST on club services',
    help: 'The GST taken out of what the club collects, and what it is charged on.',
    fields: { rate_basis_points: 'Rate', basis: 'Charged on' },
    options: { rake: 'The rake', table_fee: 'A table fee' },
  },
  'high_hand.payouts': {
    name: 'High-hand prizes',
    help: 'What each high hand pays. 0 pays nothing.',
    fields: { royal_flush: 'Royal flush', straight_flush: 'Straight flush', four_of_a_kind: 'Four of a kind' },
  },
  'host.lapse': {
    name: 'Lapsed regular',
    help: 'When a regular goes to the host queue',
    fields: { visits: 'Visits in six months', days: 'Then away for' },
  },
  'jackpot.drop': {
    name: 'Jackpot drop',
    help: 'What every pot above a size drops into the bad-beat jackpot while it is live.',
    fields: { drop_paise: 'Drop', above_paise: 'From pots above' },
  },
  'jackpot.payout': {
    name: 'Bad-beat payout',
    help: 'The share of the main pool a bad beat pays, and how it splits between the loser, the winner and the others dealt in, which together make 100%.',
    fields: { pool_basis_points: 'Of the main pool', loser_basis_points: 'Loser', winner_basis_points: 'Winner', table_basis_points: 'Others dealt in' },
  },
  'jackpot.shares': {
    name: 'Jackpot pool shares',
    help: 'The parts of every jackpot drop kept for the season and freeroll pools, up to 50% each. The main pool takes the rest.',
    fields: { season_basis_points: 'Season pool', freeroll_basis_points: 'Freeroll pool' },
  },
  'markers.due_days': {
    name: 'Marker due after',
    help: 'How long after it is issued a marker falls due. A member with a marker past due gets no new credit.',
    fields: { days: 'Days' },
  },
  'bonus.daily_staff_cap': {
    name: 'Daily bonus chips limit', fields: { chips: 'Bonus chips' },
    help: 'Most one staff member adds in a day',
  },
  'bonus.expiry_days': {
    name: 'Bonus chips expire', fields: { days: 'Days' },
    help: 'Unused Bonus is removed after this long',
  },
  'bonus.visit_cap': {
    name: 'Bonus per visit', fields: { basis_points: 'Share' },
    help: 'Share of their Bonus used in one visit',
  },
  'rake.config': {
    name: 'Rake',
    help: 'The rake taken from each pot at this table type, and its cap. Rake and jackpot changes start at least a minute from now.',
    fields: { rate_basis_points: 'Rate', cap_paise: 'Cap' },
  },
  'rakeback.rate': {
    name: 'Rakeback',
    help: "The share of a member's rake at this table type over a club week, given back as bonus chips each Monday, held to a cap and lasting the days given. Not set gives none.",
    fields: { basis_points: 'Share', cap_paise: 'Cap', expires_days: 'Bonus chips last' },
  },
  'reports.unclaimed_days': {
    name: 'Unclaimed balance after',
    help: 'A balance is unclaimed after this long with no money moved and no visit. 365 days unless set.',
    fields: { days: 'Days' },
  },
  'social.connected_channels': {
    name: 'Connected social channels',
    help: 'Channels that post by themselves. Others offer a download.',
    fields: { channels: 'Channels' },
    options: {
      instagram: 'Instagram', facebook: 'Facebook', x: 'X', linkedin: 'LinkedIn', youtube: 'YouTube', telegram: 'Telegram',
      google_business_profile: 'Google Business Profile', whatsapp: 'WhatsApp',
    },
  },
  'tds.config': {
    name: 'TDS on winnings',
    help: 'Whether TDS is taken from winnings (while off, every cash-out still records it), under which section, at what rate, above what net winnings and over what period, and the rate for a member with no PAN.',
    fields: {
      enabled: 'Take TDS', section: 'Section', rate_basis_points: 'Rate', threshold_paise: 'Net winnings above', basis: 'Counted over',
      pan_required: 'PAN needed', no_pan_rate_basis_points: 'Rate without a PAN',
    },
    options: { session: 'Each session', day: 'Each club day', financial_year: 'The financial year' },
  },
  'tier.default': {
    name: 'Starting tier',
    help: 'The tier every new member starts in',
    fields: { tier_id: 'Tier' },
  },
};

/** A setting's words, or undefined for a key with none yet. */
export function settingCopy(key: string): SettingCopy | undefined {
  return Object.hasOwn(settingKeys, key) ? settingKeys[key] : undefined;
}
