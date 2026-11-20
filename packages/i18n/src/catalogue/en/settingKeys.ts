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
  /** Under a field in the setting's panel: what a value means where its limits do not say ("0 is never."). */
  readonly hints?: Readonly<Record<string, string>>;
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
  'bonus.daily_staff_cap': {
    name: 'Daily Bonus limit', fields: { chips: 'Bonus' },
    help: 'Most one staff member adds in a day',
    hints: { chips: 'Past it an addition is refused and you are told. Super admins have no limit. No limit unless set.' },
  },
  'bonus.by_hand_cap': {
    name: 'Bonus added by hand', fields: { chips: 'Bonus' },
    help: 'Most staff can add at once',
    hints: { chips: 'For admins and floor managers. Super admins have no limit.' },
  },
  'bonus.expiry_days': {
    name: 'Bonus expires', fields: { days: 'Days' },
    help: 'Unused Bonus is removed after this long',
    hints: { days: '0 is never. What is held already lasts this long from when it starts.' },
  },
  'bonus.visit_cap': {
    name: 'Bonus per visit', fields: { basis_points: 'Share' },
    help: 'Share of their Bonus used in one visit',
    hints: { basis_points: "Of what they held at the visit's first Bonus use, in whole 50s. No limit unless set." },
  },
  'rake.config': {
    name: 'Rake',
    help: 'The rake taken from each pot at this table type, and its cap. Rake and jackpot changes start at least a minute from now.',
    fields: { rate_basis_points: 'Rate', cap_paise: 'Cap' },
  },
  'rakeback.rate': {
    name: 'Rakeback',
    help: "The share of a member's rake at this table type over a club week, given back as Bonus each Monday, held to a cap and lasting the days given. Not set gives none.",
    fields: { basis_points: 'Share', cap_paise: 'Cap', expires_days: 'Bonus lasts' },
  },
  'reports.unclaimed_days': {
    name: 'Unclaimed balance after',
    help: 'A balance is unclaimed after this long with no money moved and no visit. 365 days unless set.',
    fields: { days: 'Days' },
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
